import { randomUUID } from "node:crypto";
import { invalidateTags, refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { HERO_VERSION, layoutFor } from "@/lib/layout/hero";
import { AuditRepository } from "@/server/audit";
import { PageLayout } from "@/server/models";
import type { BlockBase } from "@/server/models/layout";

const audit = new AuditRepository();

/**
 * H6.13: the home hero becomes a full banner by default. This converts the hero blocks saved before that (no `heroVersion`).
 *
 * - A block with no layout and no look setting of its own is the old default: it gets layout "full".
 * - A block with its own look setting (and no layout) keeps the split hero it had: it gets layout "split". Its settings are not touched.
 * - A block with a layout the user chose keeps it. Only the version is added.
 * - Every converted block gets `heroVersion`, so a second run changes nothing.
 */

/** The converted props of one saved hero block, or null when it is already at the current version. Never changes the input. */
export function convertHeroProps(props: Record<string, unknown>): Record<string, unknown> | null {
  if (props.heroVersion !== undefined) return null;
  return { ...props, layout: layoutFor(props), heroVersion: HERO_VERSION };
}

/** Converts every hero block in one saved block list. Other blocks are returned as they are. */
export function convertHeroBlocks(blocks: BlockBase[]): { blocks: BlockBase[]; changed: number } {
  let changed = 0;
  const out = blocks.map((block) => {
    if (block.type !== "hero") return block;
    const props = convertHeroProps(block.props ?? {});
    if (!props) return block;
    changed += 1;
    return { ...block, props };
  });
  return { blocks: out, changed };
}

/**
 * Converts the stored home hero (draft and published) in the database. Idempotent: the second run finds nothing to change.
 * Called from the daily cron route and from the seed. Returns how many home layouts were written.
 */
export async function convertHeroLayouts(requestId: string) {
  await connectDb();
  const docs = await PageLayout.find({ key: "home" }).lean();
  let updated = 0;
  for (const doc of docs) {
    const draft = convertHeroBlocks(Array.isArray(doc.draft) ? (doc.draft as BlockBase[]) : []);
    const published = convertHeroBlocks(Array.isArray(doc.published) ? (doc.published as BlockBase[]) : []);
    const set: Record<string, unknown> = {};
    if (draft.changed) set.draft = draft.blocks;
    if (published.changed) set.published = published.blocks;
    if (Object.keys(set).length === 0) continue;
    await PageLayout.updateOne({ _id: doc._id }, { $set: set });
    updated += 1;
  }
  if (updated > 0) {
    await audit.append({
      actorType: "system",
      action: "layout.hero.convert",
      targetType: "layout",
      targetId: "home/default",
      requestId: requestId || randomUUID(),
      after: { version: HERO_VERSION, documents: updated },
    });
    // The home page is read through the layout cache and the public pages: drop both so the banner is live at once.
    invalidateTags(["layout:home"]);
    await refreshPublicCache();
  }
  return { updated };
}
