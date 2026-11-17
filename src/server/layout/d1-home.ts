import { randomUUID } from "node:crypto";
import { invalidateTags, refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { getHomepageContent } from "@/lib/queries";
import { pickTexts } from "@/lib/ui/text";
import { textOverrides } from "@/app/admin/ui-text/store";
import { AuditRepository } from "@/server/audit";
import { ConflictError } from "@/server/http";
import { homeBlocksFrom } from "@/server/layout/home-v2";
import { validateBlocks } from "@/server/layout/service";
import { PageLayout, PageLayoutRevision } from "@/server/models";
import type { BlockBase } from "@/server/models/layout";
import { readShellConfig } from "@/server/site-links/shell-config";

const audit = new AuditRepository();

export const D1_NOTE = "D1";

export type D1Action = "dry-run" | "applied" | "unchanged" | "refused";

export interface D1Result {
  action: D1Action;
  reason?: string;
  fromVersion: number;
  fromFormat: 1 | 2;
  toVersion: number;
  blocks: BlockBase[];
}

/** The format 2 home blocks for the page as it is stored today: banner and search, trust pills, categories, latest ads, how it works. */
async function buildHomeLayoutBlocks(): Promise<BlockBase[]> {
  const [content, shell, overrides] = await Promise.all([getHomepageContent(), readShellConfig(), textOverrides()]);
  const built = homeBlocksFrom({
    hero: content.hero,
    shell,
    texts: pickTexts(overrides, "card.", "home."),
    categoriesCount: content.homeCategoriesCount,
  });
  return validateBlocks("home", built, new Set(built.map((block) => block.id)));
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * D1. Builds the format 2 home layout from the stored home page and, only when `apply` is true, publishes it as the next version
 * with the note "D1". A dry run reads and validates but writes nothing. The version it replaces stays as a revision.
 * It refuses to replace a format 2 home that someone has already changed, and does nothing when the home is already these blocks.
 * It never turns the `homeFromLayout` switch on.
 */
export async function runHomeLayoutD1(input: { apply: boolean; actor?: string }): Promise<D1Result> {
  await connectDb();
  const blocks = await buildHomeLayoutBlocks();
  const current = await PageLayout.findOne({ key: "home", scope: "default" }).lean();
  const fromVersion = current?.version ?? 0;
  const fromFormat: 1 | 2 = current?.format === 2 ? 2 : 1;
  const head = { fromVersion, fromFormat, blocks };
  if (current?.publishedAt && fromFormat === 2) {
    if (same(current.published, blocks)) return { ...head, action: "unchanged", toVersion: fromVersion };
    return { ...head, action: "refused", reason: "A format 2 home is already published and differs from the stored page. It was not replaced.", toVersion: fromVersion };
  }
  const toVersion = fromVersion + 1;
  if (!input.apply) return { ...head, action: "dry-run", toVersion };
  const actor = input.actor || "D1";
  const now = new Date();
  const set = { format: 2 as const, draft: blocks, published: blocks, version: toVersion, updatedBy: actor, publishedBy: actor, publishedAt: now };
  if (current) {
    const updated = await PageLayout.findOneAndUpdate({ key: "home", scope: "default", version: current.version }, { $set: set }, { new: true }).lean();
    if (!updated) throw new ConflictError("The home layout changed while D1 was running. Run it again.");
  } else {
    await PageLayout.create({ key: "home", scope: "default", ...set });
  }
  await PageLayoutRevision.create({ key: "home", scope: "default", format: 2, version: toVersion, blocks, publishedBy: actor, publishedAt: now, note: D1_NOTE });
  await audit.append({
    actorType: "system",
    action: "layout.d1.apply",
    targetType: "layout",
    targetId: "home/default",
    before: { version: fromVersion, format: fromFormat },
    after: { version: toVersion, format: 2, blocks },
    reason: D1_NOTE,
    requestId: randomUUID(),
  });
  invalidateTags(["layout:home"]);
  await refreshPublicCache();
  return { ...head, action: "applied", toVersion };
}
