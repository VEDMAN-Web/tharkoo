import { readContent } from "@/lib/ui/site-content";
import { ensureHomepageDocument } from "@/lib/ui/site-store";
import { homeDefaultBlocks } from "@/server/layout/defaults/home";
import { validateBlocks } from "@/server/layout/service";
import { PageLayout, PageLayoutRevision, Site } from "@/server/models";

/** The format 1 home that `seedHomeLayout` made before H8.19: a hero and the old blocks, version 1. Used by tests that need an old layout in the database. */
export async function seedLegacyHome() {
  await ensureHomepageDocument();
  const site = await Site.findOne({ key: "default" }).lean();
  const blocks = validateBlocks("home", homeDefaultBlocks(readContent(site?.homepage)), new Set());
  const now = new Date();
  await PageLayout.create({ key: "home", scope: "default", draft: blocks, published: blocks, version: 1, updatedBy: "system", publishedBy: "system", publishedAt: now });
  await PageLayoutRevision.create({ key: "home", scope: "default", version: 1, blocks, publishedBy: "system", publishedAt: now, note: "Default layout from the current home page" });
}
