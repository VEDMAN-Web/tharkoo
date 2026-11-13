/**
 * Ledger accounts. Every coin sits in exactly one account. `external` is the world outside the site
 * (a customer paying in, a bank paying out): it is the counter-account for coins entering or leaving.
 */
export const LEDGER_ACCOUNTS = [
  "user_wallet",
  "escrow",
  "vendor_earnings",
  "payout_pending",
  "paid_out",
  "platform_revenue",
  "external",
] as const;

export type LedgerAccount = (typeof LEDGER_ACCOUNTS)[number];

/** Accounts that can never go below zero. The others only grow (paid_out, platform_revenue) or mirror the outside (external). */
const NON_NEGATIVE = new Set<LedgerAccount>(["user_wallet", "escrow", "vendor_earnings", "payout_pending"]);

export function isLedgerAccount(value: string): value is LedgerAccount {
  return (LEDGER_ACCOUNTS as readonly string[]).includes(value);
}

export function mustStayNonNegative(account: LedgerAccount) {
  return NON_NEGATIVE.has(account);
}

/** Owner key used for accounts that belong to the site, not to a user. */
export const SYSTEM_OWNER = "system";
