import { connectDb } from "@/lib/db";
import { accountBalance } from "@/server/ledger";

/**
 * H9.2: does this account have earnings at all? True when an advertiser has credits to withdraw, a withdrawal on its way, or
 * one already paid out. Only then do the panel pages show the Earnings tab and the Withdraw link. Read from the ledger, never guessed.
 */
export async function hasEarnings(userId: string): Promise<boolean> {
  await connectDb();
  const [available, pending, paid] = await Promise.all([accountBalance("vendor_earnings", userId), accountBalance("payout_pending", userId), accountBalance("paid_out", userId)]);
  return available > 0 || pending > 0 || paid > 0;
}
