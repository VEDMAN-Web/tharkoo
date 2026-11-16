import { attributePicks, hasFieldPicks, type FilterField, type ListingToggles } from "./listing-filters";
import type { ListingParams } from "@/server/search/filter-seo";

export function narrowFromParams(sp: ListingParams, fields: readonly FilterField[] | undefined) {
  const picks = attributePicks(sp, fields);
  const flag = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) === "1";
  const toggles: ListingToggles = { verified: flag(sp.verified), photos: flag(sp.photos), video: flag(sp.video), online: flag(sp.online) };
  const filter = {
    ...(hasFieldPicks(picks) ? { attributes: picks } : {}),
    ...(toggles.verified ? { verified: true } : {}),
    ...(toggles.photos ? { photos: { $exists: true, $ne: [] } } : {}),
    ...(toggles.video ? { video: true } : {}),
    ...(toggles.online ? { online: true } : {}),
  };
  return { picks, toggles, filter };
}
