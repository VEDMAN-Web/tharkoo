import { connectDb } from "@/lib/db";
import { safeHref } from "@/lib/sanitize";
import { SiteMedia } from "@/server/models";

export type PagePicture = { src: string; alt: string };

/**
 * The newest picture in the Media library that carries this tag, with the alt text written there. Nothing tagged means
 * no picture, so the page draws no box. Trashed pictures are never used.
 */
export async function taggedPicture(tag: string): Promise<PagePicture | null> {
  await connectDb();
  const row = await SiteMedia.findOne({ tags: tag, trashedAt: null }).sort({ createdAt: -1 }).select({ url: 1, alt: 1 }).lean<{ url: string; alt: string }>();
  const src = row ? safeHref(row.url) : "";
  return row && src ? { src, alt: row.alt } : null;
}
