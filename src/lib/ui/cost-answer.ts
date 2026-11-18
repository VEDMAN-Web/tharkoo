import type { makeT } from "@/lib/ui/text";

/** The answer follows the live posting rule: free when paid posting is off, else the free ads first, then the posting fee. Words are site-text keys. */
export function costAnswer(t: ReturnType<typeof makeT>, money: { paidPostingOn: boolean; postingFeeCredits: number; creditPriceInr: number; freeAdsPerAccount: number }) {
  if (!money.paidPostingOn || money.postingFeeCredits <= 0) return t("howitworks.cost.free");
  const credits = `${money.postingFeeCredits} ${money.postingFeeCredits === 1 ? "credit" : "credits"}`;
  const rupees = `₹${(money.postingFeeCredits * money.creditPriceInr).toLocaleString("en-IN")}`;
  if (money.freeAdsPerAccount > 0) return t("howitworks.cost.freeThenFee", { free: money.freeAdsPerAccount, credits, rupees });
  return t("howitworks.cost.fee", { credits, rupees });
}
