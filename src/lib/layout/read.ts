import { cached } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { PageLayout } from "@/server/models";
import type { BlockBase, PageKey } from "@/server/models/layout";

const TTL_MS = 60_000;

/** A block with a start or end date only shows inside that window. */
export function inWindow(block: Pick<BlockBase, "startsAt" | "endsAt">, now: Date): boolean {
  const time = now.getTime();
  if (block.startsAt && Date.parse(block.startsAt) > time) return false;
  if (block.endsAt && Date.parse(block.endsAt) <= time) return false;
  return true;
}

async function loadPublished(key: PageKey, scopes: string[]): Promise<BlockBase[] | null> {
  await connectDb();
  const docs = await PageLayout.find({ key, scope: { $in: scopes }, publishedAt: { $ne: null } }).lean();
  for (const scope of scopes) {
    const doc = docs.find((row) => row.scope === scope);
    if (doc) return JSON.parse(JSON.stringify(doc.published)) as BlockBase[];
  }
  return null;
}

/**
 * Published blocks of the first scope that has a published layout (scopes are tried in the order given),
 * with hidden blocks and blocks outside their date window removed.
 * Returns null when nothing is published, so the page keeps its current built-in rendering.
 * The stored layout is cached with the tag `layout:<key>`; publishing clears it. Dates are checked on every call.
 */
export async function getPageBlocks(key: PageKey, scopes: string[], now: Date = new Date()): Promise<BlockBase[] | null> {
  const blocks = await cached(`layout:${key}:${scopes.join("|")}`, TTL_MS, () => loadPublished(key, scopes), [`layout:${key}`]);
  if (!blocks) return null;
  return blocks.filter((block) => block.visible && inWindow(block, now));
}
