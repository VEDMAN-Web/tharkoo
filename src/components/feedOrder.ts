const PAID = new Set(["star", "supertop", "flash", "top", "highlight"]);

/** Stable within one hour: the same seed gives the same shuffle. */
export function hourSeed(now = Date.now()) {
  return Math.floor(now / 3_600_000);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Paid tiers keep their ranked order and come first; free ads follow, shuffled by the seed. */
export function orderFeed<T extends { variant?: string }>(items: T[], seed: number): T[] {
  const paid = items.filter((ad) => PAID.has(ad.variant || ""));
  const free = items.filter((ad) => !PAID.has(ad.variant || ""));
  const next = mulberry32(seed);
  for (let i = free.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [free[i], free[j]] = [free[j], free[i]];
  }
  return [...paid, ...free];
}
