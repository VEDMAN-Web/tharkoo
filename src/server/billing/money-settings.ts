import { z } from "zod";
import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import { isAdminRole } from "@/lib/ui/site-content";
import { AuditRepository } from "@/server/audit";
import { ForbiddenError, parseInput } from "@/server/http";
import { Site } from "@/server/models";

const SITE_KEY = "default";
const audit = new AuditRepository();

export const MONEY_DEFAULTS = { postingFeeCredits: 30, creditPriceInr: 10, mockPaymentsOn: true, paidPostingOn: false } as const;

export type MoneySettings = { postingFeeCredits: number; creditPriceInr: number; mockPaymentsOn: boolean; paidPostingOn: boolean };

export const moneySettingsBodySchema = z
  .object({
    postingFeeCredits: z.number().int().min(0).max(100_000),
    creditPriceInr: z.number().int().min(1).max(100_000),
    mockPaymentsOn: z.boolean(),
    paidPostingOn: z.boolean(),
  })
  .partial()
  .strict();

function whole(value: unknown, fallback: number, min: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= min ? value : fallback;
}

export async function readMoneySettings(): Promise<MoneySettings> {
  await connectDb();
  const site = await Site.findOne({ key: SITE_KEY })
    .select("postingFeeCredits creditPriceInr mockPaymentsOn paidPostingOn")
    .lean<Partial<MoneySettings> | null>();
  return {
    postingFeeCredits: whole(site?.postingFeeCredits, MONEY_DEFAULTS.postingFeeCredits, 0),
    creditPriceInr: whole(site?.creditPriceInr, MONEY_DEFAULTS.creditPriceInr, 1),
    mockPaymentsOn: typeof site?.mockPaymentsOn === "boolean" ? site.mockPaymentsOn : MONEY_DEFAULTS.mockPaymentsOn,
    paidPostingOn: typeof site?.paidPostingOn === "boolean" ? site.paidPostingOn : MONEY_DEFAULTS.paidPostingOn,
  };
}

export function effectivePostingFee(settings: MoneySettings): number {
  return settings.paidPostingOn ? settings.postingFeeCredits : 0;
}

export async function setMoneySettings(input: { actorId: string; roles: readonly string[]; values: unknown; requestId: string }) {
  if (!isAdminRole([...input.roles])) throw new ForbiddenError("Only an admin can change this setting");
  const values = parseInput(moneySettingsBodySchema, input.values);
  await connectDb();
  const before = await readMoneySettings();
  await Site.updateOne({ key: SITE_KEY }, { $set: values }, { upsert: true, strict: false });
  const after = await readMoneySettings();
  await audit.append({
    actorId: input.actorId,
    actorType: "admin",
    action: "settings.money.update",
    targetType: "site",
    targetId: SITE_KEY,
    requestId: input.requestId,
    before,
    after,
  });
  await refreshPublicCache();
  return after;
}
