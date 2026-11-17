import { can } from "@/lib/admin/perms";
import { connectDb } from "@/lib/db";
import { homeFromLayoutOn } from "@/lib/layout/home-read";
import { adminWrite } from "@/server/admin/write";
import type { AdminCtx } from "@/server/admin/context";
import { ForbiddenError, NotFoundError } from "@/server/http";
import { buildHomeLayoutBlocks } from "@/server/layout/d1-home";
import { formatOf, listRevisions, publish, restore, saveDraft } from "@/server/layout/service";
import { homePickerData, type HomeSelectionRow } from "@/server/listings/home-selection";
import { PageLayout } from "@/server/models";
import type { BlockBase } from "@/server/models/layout";

const KEY = "home";
const SCOPE = "default";

export interface HomeBuilderState {
  blocks: BlockBase[];
  /** True when nothing usable is saved yet, so the blocks were made from today's Home page. */
  starter: boolean;
  liveVersion: number;
  liveFormat: 1 | 2;
  draftSavedAt: string | null;
  revisions: { version: number; publishedBy: string; publishedAt: string; note: string }[];
  slots: HomeSelectionRow[];
  switchOn: boolean;
}

const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function allow(ctx: AdminCtx) {
  if (!can(ctx.roles, "pages.edit")) throw new ForbiddenError("Only an admin can edit the Home page");
}

/** Everything the Home tab needs: the draft (or a starting draft from today's page), the versions and the 8 chosen ads. */
export async function loadHomeBuilder(ctx: AdminCtx): Promise<HomeBuilderState> {
  allow(ctx);
  await connectDb();
  const doc = await PageLayout.findOne({ key: KEY, scope: SCOPE }).lean();
  const saved = (doc?.draft ?? []) as BlockBase[];
  const starter = formatOf(saved) !== 2;
  const [blocks, revisions, picker, switchOn] = await Promise.all([
    starter ? buildHomeLayoutBlocks() : Promise.resolve(saved),
    listRevisions(KEY, SCOPE, ctx.roles),
    homePickerData(),
    homeFromLayoutOn(),
  ]);
  return plain({
    blocks,
    starter,
    liveVersion: doc?.publishedAt ? doc.version : 0,
    liveFormat: doc?.format === 2 ? 2 : 1,
    draftSavedAt: !starter && doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    revisions: revisions.map((row) => ({ version: row.version, publishedBy: row.publishedBy, publishedAt: new Date(row.publishedAt).toISOString(), note: row.note })),
    slots: picker.pinned,
    switchOn,
  });
}

export async function saveHomeDraft(ctx: AdminCtx, blocks: unknown) {
  allow(ctx);
  await connectDb();
  const saved = await saveDraft({ key: KEY, scope: SCOPE, blocks, email: ctx.email, roles: ctx.roles });
  return { blocks: plain(saved.blocks), savedAt: new Date().toISOString() };
}

/** Publishes the saved draft as the next version, through the audited write path, with an Undo that puts the previous version back. */
export async function publishHome(ctx: AdminCtx, note?: string) {
  allow(ctx);
  await connectDb();
  const current = await PageLayout.findOne({ key: KEY, scope: SCOPE }).lean();
  if (!current) throw new NotFoundError("There is no draft to publish yet");
  const wasLive = current.publishedAt ? current.version : 0;
  const done = await adminWrite(ctx, {
    perm: "pages.edit",
    action: "layout.publish",
    target: { type: "layout", id: `${KEY}/${SCOPE}`, label: "Home page" },
    texts: [current.draft, note],
    ...(wasLive > 0 ? { undo: { kind: "layout.publish" as const, windowKey: "edits" as const } } : {}),
    before: async () => ({ version: current.version, format: current.format ?? 1 }),
    apply: async () => {
      const { version } = await publish({ key: KEY, scope: SCOPE, email: ctx.email, roles: ctx.roles, note }, { audit: false });
      return {
        after: { version },
        result: { version },
        undoData: { key: KEY, scope: SCOPE, restoreVersion: wasLive, atVersion: version },
        summary: `Published the Home page as version ${version}`,
      };
    },
  });
  return { version: done.result.version, eventId: done.eventId, canUndo: wasLive > 0 && done.eventId !== "" };
}

/** Puts an earlier version into the draft. It is not live until it is published. */
export async function restoreHomeVersion(ctx: AdminCtx, version: number) {
  allow(ctx);
  await connectDb();
  const done = await restore({ key: KEY, scope: SCOPE, version, email: ctx.email, roles: ctx.roles });
  return { blocks: plain(done.blocks) };
}
