import { accountBalance } from "@/server/ledger";
import { Withdrawal } from "@/server/wallet/withdrawals";
import { connectDb } from "@/lib/db";
import { objectId } from "@/server/billing/ledger";

/**
 * H9.1: whether an account has earnings worth showing (an Earnings tab, a Withdraw button). One small rule for every screen:
 * anything waiting, asked for or paid out counts, and so does any withdrawal request. Nothing here is made up; it reads the ledger.
 */
export function earningsPresent(balances: { available: number; pending: number; paid: number }, withdrawals: number): boolean {
  return balances.available > 0 || balances.pending > 0 || balances.paid > 0 || withdrawals > 0;
}

export async function userHasEarnings(userId: string): Promise<boolean> {
  await connectDb();
  const [available, pending, paid, withdrawals] = await Promise.all([
    accountBalance("vendor_earnings", userId),
    accountBalance("payout_pending", userId),
    accountBalance("paid_out", userId),
    Withdrawal.countDocuments({ userId: objectId(userId, "userId") }),
  ]);
  return earningsPresent({ available, pending, paid }, withdrawals);
}
