import { connectDb } from "@/lib/db";
import { Category, Location, SiteMedia } from "@/server/models";
import type { CatalogBandDoc, CatalogPhotoDoc } from "@/server/models/catalog";
import { isSafeImageUrl, type ShellImage } from "@/server/site-links/shell-config-rules";

/**
 * H7.160: the pictures partners set in the new boxes on Categories & fields and Cities & areas (H8.39) must show on the site.
 * The public pages read their pictures from the shell config (`media.images`, the old rows on Menus and footer). This module turns the
 * new fields into the same rows and puts them in front: for each category or place and each slot (card photo, band for computers,
 * band for phones) the NEW picture wins, and the old row fills any slot the new boxes leave empty. Nothing stored is changed.
 */

type Slots = { slug: string; photo?: CatalogPhotoDoc; band?: CatalogBandDoc };
type Lean = Slots & { _id: unknown };
type Media = { _id: unknown; url: string; trashedAt?: Date | null };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const safe = (url: string | undefined) => (url && isSafeImageUrl(url) ? url : "");

/** Puts the new rows in front of the old ones, slot by slot. Pure, so the pages and the tests share it. */
export function mergeCatalogueImages(old: readonly ShellImage[], fresh: readonly ShellImage[]): ShellImage[] {
  const out = old.map((row) => ({ ...row }));
  for (const row of fresh) {
    const at = out.findIndex((item) => item.scope === row.scope && same(item.slug, row.slug));
    if (at < 0) {
      out.push({ ...row });
      continue;
    }
    const was = out[at];
    out[at] = {
      ...was,
      ...(row.photo ? { photo: row.photo, focusX: row.focusX, focusY: row.focusY } : {}),
      ...(row.band ? { band: row.band, bandFocusX: row.bandFocusX, bandFocusY: row.bandFocusY } : {}),
      ...(row.bandPhone ? { bandPhone: row.bandPhone } : {}),
    };
  }
  return out;
}

function rowOf(scope: ShellImage["scope"], doc: Slots, urls: Map<string, string>): ShellImage | null {
  const photo = doc.photo?.mediaId ? safe(urls.get(String(doc.photo.mediaId))) : "";
  const band = doc.band?.mediaId ? safe(urls.get(String(doc.band.mediaId))) : "";
  const bandPhone = band && doc.band?.phoneMediaId ? safe(urls.get(String(doc.band.phoneMediaId))) : "";
  if (!photo && !band) return null;
  return {
    scope,
    slug: doc.slug,
    photo,
    band,
    bandPhone,
    ...(photo ? { focusX: doc.photo?.focusX, focusY: doc.photo?.focusY } : {}),
    ...(band ? { bandFocusX: doc.band?.focusX, bandFocusY: doc.band?.focusY } : {}),
  };
}

/** The pictures set in the new boxes, as shell image rows. A picture in the Trash or without a safe address is left out. */
export async function loadCatalogueImages(): Promise<ShellImage[]> {
  await connectDb();
  const withPictures = { $or: [{ "photo.mediaId": { $exists: true } }, { "band.mediaId": { $exists: true } }] };
  const [categories, places] = await Promise.all([
    Category.find({ deletedAt: null, ...withPictures }).select("slug photo band").lean<Lean[]>(),
    Location.find({ type: { $in: ["city", "state"] }, ...withPictures }).select("slug type photo band").lean<(Lean & { type: "city" | "state" })[]>(),
  ]);
  const ids = new Set<string>();
  for (const doc of [...categories, ...places]) for (const id of [doc.photo?.mediaId, doc.band?.mediaId, doc.band?.phoneMediaId]) if (id) ids.add(String(id));
  if (ids.size === 0) return [];
  const media = await SiteMedia.find({ _id: { $in: [...ids] }, trashedAt: null }).select("url").lean<Media[]>();
  const urls = new Map(media.map((row) => [String(row._id), row.url]));
  const rows: ShellImage[] = [];
  for (const doc of categories) {
    const row = rowOf("category", doc, urls);
    if (row) rows.push(row);
  }
  for (const doc of places) {
    const row = rowOf(doc.type, doc, urls);
    if (row) rows.push(row);
  }
  return rows;
}
