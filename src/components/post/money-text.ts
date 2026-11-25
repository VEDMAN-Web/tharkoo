import type { UiTextKey } from "@/lib/ui/text";
import { creditsText } from "./credits";

/**
 * H21.12a: every money sentence of the post form comes from here, from the one answer of /api/wallet/posting-fee, so the step-1 note,
 * the cost box and the Publish button always show the same number.
 */

type T = (key: UiTextKey, values?: Record<string, string | number>) => string;

/** The free ads of the account: how many are still to use (counting this one) out of how many. */
export type FreeQuota = { left: number; total: number } | null;

export type ThisAdMoney = {
  /** Paid posting is on for the site. */
  paidOn: boolean;
  /** What posting this ad costs in credits: 0 when it is free. */
  fee: number;
  quota: FreeQuota;
};

/** The line under the category tiles on step 1. Empty when there is nothing to say. */
export function feeNote(t: T, money: ThisAdMoney): string {
  if (!money.paidOn) return "";
  const total = money.quota?.total ?? 0;
  if (money.fee > 0) {
    const credits = creditsText(money.fee);
    if (total <= 0) return t("post.v2.cat.notePaid", { fee: money.fee });
    return total === 1 ? t("post.v2.money.noteUsedOne", { credits }) : t("post.v2.money.noteUsed", { credits, total });
  }
  return money.quota && money.quota.left > 0 ? t("post.v2.money.noteFree", { left: money.quota.left, total }) : "";
}

/** "(2 of 3 free ads left)" beside a free posting. */
export function freeLeftText(t: T, money: ThisAdMoney): string {
  return money.paidOn && money.fee === 0 && money.quota && money.quota.left > 0 ? t("post.v2.rev.costFreeLeft", { left: money.quota.left, total: money.quota.total }) : "";
}

export type CostBox = {
  posting: string;
  postingNote: string;
  boost: string;
  total: string;
};

/** The one cost box of the review step: Posting this ad, Boost, Total today. */
export function costBox(t: T, input: { money: ThisAdMoney; plan: { name: string; amount: number } | null }): CostBox {
  const { money, plan } = input;
  const boost = plan ? Math.max(0, plan.amount) : 0;
  const total = Math.max(0, money.fee) + boost;
  return {
    posting: creditsText(Math.max(0, money.fee)),
    postingNote: freeLeftText(t, money),
    boost: plan ? `${plan.name} · ${creditsText(boost)}` : creditsText(0),
    total: creditsText(total),
  };
}

/** The words on the Publish button: the total is always on it, unless there is nothing to pay. */
export function publishLabel(t: T, total: number, planName: string): string {
  if (total <= 0) return t("post.v2.rev.publish");
  const credits = creditsText(total);
  return planName ? t("post.v2.money.publishWith", { plan: planName, credits }) : t("post.v2.money.publish", { credits });
}

/** "+919000000000" reads "+91 90000 00000". Anything else is shown as typed. */
export function formatPhone(raw: string): string {
  const match = /^(\+\d{1,3}?)(\d{5})(\d{5})$/.exec(raw);
  return match ? `${match[1]} ${match[2]} ${match[3]}` : raw;
}
