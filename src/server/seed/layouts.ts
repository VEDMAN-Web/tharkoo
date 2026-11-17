import { invalidateTags } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { ensureHomepageDocument } from "@/lib/ui/site-store";
import { buildHomeLayoutBlocks } from "@/server/layout/d1-home";
import { postDefaultBlocks } from "@/server/layout/defaults/post";
import { validateBlocks } from "@/server/layout/service";
import { PageLayout, PageLayoutRevision } from "@/server/models";

/**
 * Publishes the current home page (format 2 blocks, H8.19) as layout `home/default` version 1, if no layout exists yet.
 * Safe to run again: it does nothing when a layout is already there. Returns true when it created one.
 */
export async function seedHomeLayout(): Promise<boolean> {
  await connectDb();
  if (await PageLayout.exists({ key: "home", scope: "default" })) return false;
  await ensureHomepageDocument();
  const blocks = await buildHomeLayoutBlocks();
  const now = new Date();
  try {
    await PageLayout.create({ key: "home", scope: "default", format: 2, draft: blocks, published: blocks, version: 1, updatedBy: "system", publishedBy: "system", publishedAt: now });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return false; // another request created it first
    throw error;
  }
  await PageLayoutRevision.create({ key: "home", scope: "default", format: 2, version: 1, blocks, publishedBy: "system", publishedAt: now, note: "Default layout from the current home page" });
  invalidateTags(["layout:home"]);
  return true;
}

/** Publishes the current post-ad wizard wording as layout `post/default` version 1, if no layout exists yet. Safe to run again. */
export async function seedPostLayout(): Promise<boolean> {
  await connectDb();
  if (await PageLayout.exists({ key: "post", scope: "default" })) return false;
  const blocks = validateBlocks("post", postDefaultBlocks(), new Set());
  const now = new Date();
  try {
    await PageLayout.create({ key: "post", scope: "default", draft: blocks, published: blocks, version: 1, updatedBy: "system", publishedBy: "system", publishedAt: now });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return false; // another request created it first
    throw error;
  }
  await PageLayoutRevision.create({ key: "post", scope: "default", version: 1, blocks, publishedBy: "system", publishedAt: now, note: "Default layout from the current post-ad wizard" });
  invalidateTags(["layout:post"]);
  return true;
}

export async function seedLayouts() {
  await connectDb();
  return { home: await seedHomeLayout(), post: await seedPostLayout() };
}
