import { can } from "@/lib/admin/perms";
import { connectDb } from "@/lib/db";
import { adminWrite } from "@/server/admin/write";
import type { AdminCtx } from "@/server/admin/context";
import { effectivePostingFee, readMoneySettings } from "@/server/billing/money-settings";
import { ForbiddenError, NotFoundError } from "@/server/http";
import { postDefaultBlocks } from "@/server/layout/defaults/post";
import { listRevisions, publish, restore, saveDraft, validateBlocks } from "@/server/layout/service";
import { PageLayout } from "@/server/models";
import type { BlockBase } from "@/server/models/layout";

const KEY = "post";
const SCOPE = "default";

export interface PostBuilderState {
  blocks: BlockBase[];
  /** True when nothing is saved yet, so the blocks are today's wording. */
  starter: boolean;
  liveVersion: number;
  draftSavedAt: string | null;
  revisions: { version: number; publishedBy: string; publishedAt: string; note: string }[];
  /** The posting fee in credits today (0 while posting is free): what `{fee}` becomes. */
  fee: number;
}

const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function allow(ctx: AdminCtx) {
  if (!can(ctx.roles, "pages.edit")) throw new ForbiddenError("Only an admin can edit the Post-ad page");
}

/** Everything the Post-ad tab needs: the draft (or today's wording), the versions and the posting fee. */
export async function loadPostBuilder(ctx: AdminCtx): Promise<PostBuilderState> {
  allow(ctx);
  await connectDb();
  const doc = await PageLayout.findOne({ key: KEY, scope: SCOPE }).lean();
  const draft = (doc?.draft ?? []) as BlockBase[];
  const published = (doc?.published ?? []) as BlockBase[];
  const saved = draft.length > 0 ? draft : published;
  const starter = saved.length === 0;
  const [revisions, money] = await Promise.all([listRevisions(KEY, SCOPE, ctx.roles), readMoneySettings()]);
  return plain({
    blocks: starter ? validateBlocks(KEY, postDefaultBlocks(), new Set()) : saved,
    starter,
    liveVersion: doc?.publishedAt ? doc.version : 0,
    draftSavedAt: !starter && doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    revisions: revisions.map((row) => ({ version: row.version, publishedBy: row.publishedBy, publishedAt: new Date(row.publishedAt).toISOString(), note: row.note })),
    fee: effectivePostingFee(money),
  });
}

export async function savePostDraft(ctx: AdminCtx, blocks: unknown) {
  allow(ctx);
  await connectDb();
  const saved = await saveDraft({ key: KEY, scope: SCOPE, blocks, email: ctx.email, roles: ctx.roles });
  return { blocks: plain(saved.blocks), savedAt: new Date().toISOString() };
}

/** Publishes the saved draft as the next version, through the audited write path, with an Undo that puts the previous version back. */
export async function publishPost(ctx: AdminCtx, note?: string) {
  allow(ctx);
  await connectDb();
  const current = await PageLayout.findOne({ key: KEY, scope: SCOPE }).lean();
  if (!current) throw new NotFoundError("There is no draft to publish yet");
  const wasLive = current.publishedAt ? current.version : 0;
  const done = await adminWrite(ctx, {
    perm: "pages.edit",
    action: "layout.publish",
    target: { type: "layout", id: `${KEY}/${SCOPE}`, label: "Post-ad page" },
    texts: [current.draft, note],
    ...(wasLive > 0 ? { undo: { kind: "layout.publish" as const, windowKey: "edits" as const } } : {}),
    before: async () => ({ version: current.version, format: current.format ?? 1 }),
    apply: async () => {
      const { version } = await publish({ key: KEY, scope: SCOPE, email: ctx.email, roles: ctx.roles, note }, { audit: false });
      return {
        after: { version },
        result: { version },
        undoData: { key: KEY, scope: SCOPE, restoreVersion: wasLive, atVersion: version },
        summary: `Published the Post-ad page as version ${version}`,
      };
    },
  });
  return { version: done.result.version, eventId: done.eventId, canUndo: wasLive > 0 && done.eventId !== "" };
}

/** Puts an earlier version into the draft. It is not live until it is published. */
export async function restorePostVersion(ctx: AdminCtx, version: number) {
  allow(ctx);
  await connectDb();
  const done = await restore({ key: KEY, scope: SCOPE, version, email: ctx.email, roles: ctx.roles });
  return { blocks: plain(done.blocks) };
}
