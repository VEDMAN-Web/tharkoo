/** Pure helpers for the coupons table and form (H8.20), tested without a browser. Dates are Indian time. */

const IST_MS = 5.5 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-30" from an instant, read in Indian time. Empty for none. */
export function istDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + IST_MS).toISOString().slice(0, 10);
}

/** The instant a date field means: the start of that day, or the last second of it, in Indian time. Empty stays empty. */
export function fromIstDate(date: string, edge: "start" | "end"): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  return `${date}T${edge === "start" ? "00:00:00" : "23:59:59"}+05:30`;
}

/** "30 Nov 2026". */
export function dayText(iso: string | null): string {
  const date = istDate(iso);
  if (!date) return "";
  const [year, month, day] = date.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

export function runsText(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt && !endsAt) return "Always";
  if (startsAt && endsAt) return `${dayText(startsAt)} to ${dayText(endsAt)}`;
  return startsAt ? `From ${dayText(startsAt)}` : `Until ${dayText(endsAt)}`;
}

export function offerText(kind: string, amount: number): string {
  if (kind === "percent") return `${amount}% off`;
  if (kind === "credits") return `${amount.toLocaleString("en-IN")} free ${amount === 1 ? "credit" : "credits"}`;
  return "Old text coupon";
}

export function limitsText(redeemed: number, maxRedemptions: number | null, perUserLimit: number | null): string {
  const total = maxRedemptions === null ? `${redeemed.toLocaleString("en-IN")} used` : `${redeemed.toLocaleString("en-IN")} of ${maxRedemptions.toLocaleString("en-IN")} used`;
  return perUserLimit === null ? total : `${total}, ${perUserLimit} each`;
}
