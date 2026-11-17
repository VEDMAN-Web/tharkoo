/** H9.1: how the credit packs are chosen and worded on screen. Pure, so every screen that sells credits shows them the same way. */

export type PackLike = { id: string; credits: number; bonus: number; total: number; price: number; badge: "popular" | "best" | null };

export const FIRST_PACKS = 4;

const bySize = (packs: readonly PackLike[]) => [...packs].sort((a, b) => a.total - b.total || a.price - b.price);

/** Credits per rupee, so packs of different sizes can be compared. */
const rate = (pack: PackLike) => (pack.price > 0 ? pack.total / pack.price : 0);

/** The pack that gives the most credits for each rupee, only when it really beats the cheapest pack and is not the popular one. Otherwise nothing. */
export function bestValueId(packs: readonly PackLike[]): string | null {
  if (packs.length < 3) return null;
  const sorted = bySize(packs);
  const best = sorted.reduce((top, pack) => (rate(pack) > rate(top) ? pack : top), sorted[0]);
  const popular = popularId(packs);
  if (best.id === popular || rate(best) <= rate(sorted[0])) return null;
  return best.id;
}

/** One pack carries "Most popular": the first one the admin tagged. */
export function popularId(packs: readonly PackLike[]): string | null {
  return bySize(packs).find((pack) => pack.badge === "popular")?.id ?? null;
}

/** The smallest pack that covers a shortfall, else the biggest. */
export function coverPack(packs: readonly PackLike[], shortfall: number): PackLike | null {
  const sorted = bySize(packs);
  return sorted.find((pack) => pack.total >= shortfall) ?? sorted[sorted.length - 1] ?? null;
}

/** Up to four packs first: the cheapest, the popular one, the one that covers a shortfall, the best value, then a bigger one. Smallest first. */
export function firstPacks(packs: readonly PackLike[], shortfall = 0): PackLike[] {
  const sorted = bySize(packs);
  if (sorted.length <= FIRST_PACKS) return sorted;
  const wanted = [sorted[0], sorted.find((pack) => pack.id === popularId(sorted)), shortfall > 0 ? coverPack(sorted, shortfall) : null, sorted.find((pack) => pack.id === bestValueId(sorted)), sorted[sorted.length - 1]];
  const picked: PackLike[] = [];
  for (const pack of [...wanted, ...sorted]) {
    if (pack && !picked.some((item) => item.id === pack.id) && picked.length < FIRST_PACKS) picked.push(pack);
  }
  return bySize(picked);
}

/** The pack that starts selected: the one covering a shortfall, else the popular one, else the cheapest. */
export function preselectedId(packs: readonly PackLike[], shortfall = 0): string {
  if (packs.length === 0) return "";
  if (shortfall > 0) return coverPack(packs, shortfall)?.id ?? "";
  return popularId(packs) ?? bySize(packs)[0].id;
}

/** "About N ads": credits divided by the posting fee, rounded down. Nothing while posting is free (fee 0) or when it would read 0. */
export function adsFor(total: number, postingFee: number): number | null {
  if (!Number.isFinite(postingFee) || postingFee <= 0) return null;
  const count = Math.floor(total / postingFee);
  return count >= 1 ? count : null;
}

export const adsWord = (count: number) => `About ${count} ${count === 1 ? "ad" : "ads"}`;

/** Whole rupees with Indian grouping and no decimals: ₹1,000. */
export const rupees = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;
