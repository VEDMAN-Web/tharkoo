export const HOME_ADS_LIMIT = 8;

export function composeHomeAds<T extends { slug?: string }>(chosenSlugs: string[], chosen: T[], fill: T[], limit: number = HOME_ADS_LIMIT): T[] {
  const bySlug = new Map(chosen.map((ad) => [ad.slug || "", ad] as const));
  const ordered = chosenSlugs.map((slug) => bySlug.get(slug)).filter((ad): ad is T => Boolean(ad));
  const taken = new Set(ordered.map((ad) => ad.slug || ""));
  const rest = fill.filter((ad) => ad.slug && !taken.has(ad.slug));
  return [...ordered, ...rest].slice(0, limit);
}
