import { photoLimit } from "@/server/media/config";

/** Rows per import file. Above this the file is refused before anything is read. */
export const MAX_IMPORT_ROWS = 500;
/** Rows imported per request. A reload resumes from the last saved row. */
export const IMPORT_CHUNK_ROWS = 25;
/** Photo limit for a superadmin import when the category has no maximum of its own. Matches the promoted default. */
export const DEFAULT_CATEGORY_IMPORT_MAX = 10;

export interface PhotoRef {
  kind: "file" | "url";
  value: string;
}

export function isUrlPhoto(value: string) {
  return /^https?:\/\//i.test(value) || (value.startsWith("/") && !value.startsWith("//"));
}

/**
 * Reads the photos column. Entries are separated by "|" (";" also works). An entry that starts with http(s):// or "/"
 * is an uploaded URL, anything else is a file name taken from the chosen images. Order is kept: the first photo is the cover.
 */
export function parsePhotoCell(cell: string): PhotoRef[] {
  const refs: PhotoRef[] = [];
  for (const raw of cell.split(/[|;]/)) {
    const value = raw.trim();
    if (!value) continue;
    refs.push({ kind: isUrlPhoto(value) ? "url" : "file", value });
  }
  return refs;
}

/**
 * Photo limit for one imported row. A superadmin gets the category maximum (an admin setting, or the default).
 * Anyone else keeps the plan limit for a free listing.
 */
export function photoLimitForImport(isSuperadmin: boolean, categoryMax?: number | null) {
  if (!isSuperadmin) return photoLimit(false);
  return Number.isInteger(categoryMax) && (categoryMax as number) >= 1 ? (categoryMax as number) : DEFAULT_CATEGORY_IMPORT_MAX;
}

/** Throws the message the admin sees when a file has more rows than one import allows. */
export function assertRowCap(rowCount: number) {
  if (rowCount > MAX_IMPORT_ROWS) return `Too many rows: ${rowCount}. The limit is ${MAX_IMPORT_ROWS} per file. Split the file and import each part.`;
  return null;
}
