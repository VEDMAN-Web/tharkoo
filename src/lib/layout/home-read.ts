import { cached } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { inWindow } from "@/lib/layout/read";
import { PageLayout, Site } from "@/server/models";
import type { BlockBase } from "@/server/models/layout";

const TTL_MS = 60_000;

export interface PublishedHome {
  format: 1 | 2;
  blocks: BlockBase[];
}

export type HomeSource = "layout" | "new" | "layout-v1" | "built-in";

/** Whether the home page is drawn from the page builder layout. A missing value means off. Read fresh, never cached. */
export async function homeFromLayoutOn(): Promise<boolean> {
  await connectDb();
  const site = await Site.findOne({ key: "default" }).select("homeFromLayout").lean<{ homeFromLayout?: boolean } | null>();
  return site?.homeFromLayout === true;
}

async function loadPublishedHome(): Promise<PublishedHome | null> {
  await connectDb();
  const doc = await PageLayout.findOne({ key: "home", scope: "default", publishedAt: { $ne: null } }).lean();
  if (!doc) return null;
  return { format: doc.format === 2 ? 2 : 1, blocks: JSON.parse(JSON.stringify(doc.published)) as BlockBase[] };
}

/**
 * The published home layout with its format, hidden blocks and blocks outside their date window removed.
 * Null when nothing is published. Cached with the tag `layout:home`, which publishing clears.
 */
export async function getPublishedHome(now: Date = new Date()): Promise<PublishedHome | null> {
  const home = await cached("layout:home:default:format", TTL_MS, loadPublishedHome, ["layout:home"]);
  if (!home) return null;
  return { format: home.format, blocks: home.blocks.filter((block) => block.visible && inWindow(block, now)) };
}

/**
 * Which page the home route shows.
 * - "layout": New design is on, the switch is on and a format 2 layout is published.
 * - "new": New design is on and the layout is not used (switch off, nothing published, or a format 1 layout).
 * - "layout-v1": New design is off and a format 1 layout is published.
 * - "built-in": New design is off and there is no format 1 layout. A format 2 layout is never drawn by the old path.
 */
export function chooseHomeSource(input: { newDesign: boolean; fromLayout: boolean; published: PublishedHome | null }): HomeSource {
  const { newDesign, fromLayout, published } = input;
  if (newDesign) return fromLayout && published?.format === 2 && published.blocks.length > 0 ? "layout" : "new";
  return published && published.format === 1 ? "layout-v1" : "built-in";
}
