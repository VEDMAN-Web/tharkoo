import { z } from "zod";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { readMoneySettings } from "@/server/billing/money-settings";
import { ForbiddenError } from "@/server/http";
import { FinanceSettings } from "@/server/wallet/models";

const audit = new AuditRepository();
const KEY = "finance";

export const DEFAULT_FINANCE_SETTINGS = {
  tdsPercent: 0,
  gstPercent: 0,
  coinValueInr: 10,
  minWithdrawCoins: 5,
  withdrawCooldownDays: 3,
};

/** The rupee value of one credit is not stored here: it is the Money setting "Credit price (Rs)", read through readMoneySettings(). */
export type FinanceSettingsValues = typeof DEFAULT_FINANCE_SETTINGS;

export const financeSettingsBodySchema = z
  .object({
    tdsPercent: z.number().min(0).max(100),
    gstPercent: z.number().min(0).max(100),
    minWithdrawCoins: z.number().int().min(1).max(1000),
    withdrawCooldownDays: z.number().int().min(0).max(365),
  })
  .partial()
  .strict();

export async function getFinanceSettings(): Promise<FinanceSettingsValues> {
  await connectDb();
  const [row, money] = await Promise.all([FinanceSettings.findOne({ key: KEY }).lean(), readMoneySettings()]);
  return {
    tdsPercent: row?.tdsPercent ?? DEFAULT_FINANCE_SETTINGS.tdsPercent,
    gstPercent: row?.gstPercent ?? DEFAULT_FINANCE_SETTINGS.gstPercent,
    coinValueInr: money.creditPriceInr,
    minWithdrawCoins: row?.minWithdrawCoins ?? DEFAULT_FINANCE_SETTINGS.minWithdrawCoins,
    withdrawCooldownDays: row?.withdrawCooldownDays ?? DEFAULT_FINANCE_SETTINGS.withdrawCooldownDays,
  };
}

export function assertFinanceStaff(roles: readonly string[]) {
  if (!roles.includes("superadmin") && !roles.includes("finance")) throw new ForbiddenError("Forbidden");
}

export async function updateFinanceSettings(input: {
  actorId: string;
  roles: readonly string[];
  values: z.infer<typeof financeSettingsBodySchema>;
  requestId: string;
}) {
  await connectDb();
  assertFinanceStaff(input.roles);
  const before = await getFinanceSettings();
  await FinanceSettings.updateOne({ key: KEY }, { $set: input.values, $setOnInsert: { key: KEY } }, { upsert: true });
  const after = await getFinanceSettings();
  await audit.append({
    actorId: input.actorId,
    actorType: "admin",
    action: "finance.settings.update",
    targetType: "finance_settings",
    targetId: KEY,
    requestId: input.requestId,
    before,
    after,
  });
  return after;
}
