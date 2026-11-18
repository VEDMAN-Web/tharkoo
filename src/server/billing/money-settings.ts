import { fieldLabel } from "@/lib/admin/history-words";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import { isAdminRole } from "@/lib/ui/site-content";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { ForbiddenError, parseInput } from "@/server/http";
import { Site } from "@/server/models";

export const SITE_KEY = "default";

export const MONEY_DEFAULTS = { postingFeeCredits: 30, creditPriceInr: 10, mockPaymentsOn: true, paidPostingOn: false, freeAdsPerAccount: 3 } as const;

/** freeAdsPerAccount (H11.1): how many of an account's first ads cost nothing when Paid posting is on. */
export type MoneySettings = { postingFeeCredits: number; creditPriceInr: number; mockPaymentsOn: boolean; paidPostingOn: boolean; freeAdsPerAccount: number };

export const moneySettingsBodySchema = z
  .object({
    postingFeeCredits: z.number().int().min(0).max(100_000),
    creditPriceInr: z.number().int().min(1).max(100_000),
    mockPaymentsOn: z.boolean(),
    paidPostingOn: z.boolean(),
    freeAdsPerAccount: z.number().int().min(0).max(1000),
  })
  .partial()
  .strict();

function whole(value: unknown, fallback: number, min: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= min ? value : fallback;
}

export async function readMoneySettings(): Promise<MoneySettings> {
  await connectDb();
  const site = await Site.findOne({ key: SITE_KEY })
    .select("postingFeeCredits creditPriceInr mockPaymentsOn paidPostingOn freeAdsPerAccount")
    .lean<Partial<MoneySettings> | null>();
  return {
    postingFeeCredits: whole(site?.postingFeeCredits, MONEY_DEFAULTS.postingFeeCredits, 0),
    creditPriceInr: whole(site?.creditPriceInr, MONEY_DEFAULTS.creditPriceInr, 1),
    mockPaymentsOn: typeof site?.mockPaymentsOn === "boolean" ? site.mockPaymentsOn : MONEY_DEFAULTS.mockPaymentsOn,
    paidPostingOn: typeof site?.paidPostingOn === "boolean" ? site.paidPostingOn : MONEY_DEFAULTS.paidPostingOn,
    freeAdsPerAccount: whole(site?.freeAdsPerAccount, MONEY_DEFAULTS.freeAdsPerAccount, 0),
  };
}

export function effectivePostingFee(settings: MoneySettings): number {
  return settings.paidPostingOn ? settings.postingFeeCredits : 0;
}

function pickKeys(doc: Record<string, unknown> | null, keys: string[]) {
  return Object.fromEntries(keys.filter((key) => doc && key in doc).map((key) => [key, (doc as Record<string, unknown>)[key]]));
}

/**
 * Saves some of the five money settings through adminWrite (admin permission, audit, 30 day undo that restores only from the saved values).
 * Asks the public pages to refresh; a failed refresh is logged with the name "money settings".
 */
export async function saveMoneyValues(ctx: AdminCtx, rawValues: unknown) {
  const values = parseInput(moneySettingsBodySchema, rawValues);
  await connectDb();
  const keys = Object.keys(values);
  const written = await adminWrite(ctx, {
    perm: "prices.edit",
    action: "settings.money.update",
    target: { type: "site", id: SITE_KEY },
    undo: keys.length ? { kind: "record.restore", windowKey: "settings" } : undefined,
    before: async () => ({ ...(await readMoneySettings()) }),
    apply: async () => {
      const was = (await Site.findOne({ key: SITE_KEY }).lean()) as Record<string, unknown> | null;
      if (keys.length) await Site.updateOne({ key: SITE_KEY }, { $set: values }, { upsert: true });
      const site = (await Site.findOne({ key: SITE_KEY }).lean()) as Record<string, unknown> | null;
      const after = await readMoneySettings();
      return {
        after: { ...after },
        result: after,
        summary: keys.length ? `Changed ${keys.map(fieldLabel).join(", ")}` : "No money setting changed",
        undoData: site
          ? { model: "Site", id: String(site._id), restore: pickKeys(was, keys), unset: keys.filter((key) => !was || !(key in was)), expect: pickKeys(site, keys) }
          : undefined,
      };
    },
  });
  await refreshPublicCache("money settings");
  return { settings: written.result, eventId: written.eventId, undoUntil: written.undoUntil };
}

/** Kept for the callers that only have an actor id and roles (tests, scripts). Same rules as saveMoneyValues. */
export async function setMoneySettings(input: { actorId: string; roles: readonly string[]; values: unknown; requestId: string }) {
  await connectDb();
  if (!isAdminRole([...input.roles])) throw new ForbiddenError("Only an admin can change this setting");
  const saved = await saveMoneyValues({ actorId: input.actorId, email: "", roles: [...input.roles], requestId: input.requestId }, input.values);
  return saved.settings;
}

/** The saved order of promotion plans (their codes), or an empty list. */
export async function readPlanOrder(): Promise<string[]> {
  await connectDb();
  const site = await Site.findOne({ key: SITE_KEY }).select("planOrder").lean<{ planOrder?: string[] } | null>();
  return Array.isArray(site?.planOrder) ? site.planOrder.map(String) : [];
}
