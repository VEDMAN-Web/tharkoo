import { invalidateTags } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { readContent } from "@/lib/ui/site-content";
import { ensureHomepageDocument } from "@/lib/ui/site-store";
import { homeDefaultBlocks } from "@/server/layout/defaults/home";
import { validateBlocks } from "@/server/layout/service";
import { PageLayout, PageLayoutRevision, Site } from "@/server/models";

/**
 * Publishes the current home page as layout `home/default` version 1, if no layout exists yet.
 * Safe to run again: it does nothing when a layout is already there. Returns true when it created one.
 */
export async function seedHomeLayout(): Promise<boolean> {
  await connectDb();
  if (await PageLayout.exists({ key: "home", scope: "default" })) return false;
  await ensureHomepageDocument();
  const site = await Site.findOne({ key: "default" }).lean();
  const blocks = validateBlocks("home", homeDefaultBlocks(readContent(site?.homepage)), new Set());
  const now = new Date();
  try {
    await PageLayout.create({ key: "home", scope: "default", draft: blocks, published: blocks, version: 1, updatedBy: "system", publishedBy: "system", publishedAt: now });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return false; // another request created it first
    throw error;
  }
  await PageLayoutRevision.create({ key: "home", scope: "default", version: 1, blocks, publishedBy: "system", publishedAt: now, note: "Default layout from the current home page" });
  invalidateTags(["layout:home"]);
  return true;
}

export async function seedLayouts() {
  return { home: await seedHomeLayout() };
}
