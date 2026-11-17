import { can } from "@/lib/admin/perms";
import { connectDb } from "@/lib/db";
import { republishRevision } from "@/server/layout/service";
import { PageLayout } from "@/server/models";
import type { PageKey } from "@/server/models/layout";
import type { UndoHandler } from "../registry";

type Saved = { key: PageKey; scope: string; restoreVersion: number; atVersion: number };

/**
 * Undo of a publish (H8.16): the version that was live before comes back as the next version, so the history keeps every step.
 * It refuses when the page was published again since, and when there was no version before to go back to.
 * Undoing the undo brings the undone version back the same way.
 */
const handler: UndoHandler = {
  canUndo(ctx, event) {
    return can(ctx.roles, "pages.edit") && event.has("restoreVersion") && event.take<number>("restoreVersion") > 0;
  },

  async conflict(event) {
    await connectDb();
    const saved = readSaved(event);
    const current = await PageLayout.findOne({ key: saved.key, scope: saved.scope }).select("version updatedBy").lean<{ version: number; updatedBy?: string } | null>();
    if (current && current.version === saved.atVersion) return null;
    return { changedBy: current?.updatedBy ?? null, at: new Date().toISOString(), message: "The page was published again since. Open the versions list to restore one." };
  },

  async run(ctx, event) {
    const saved = readSaved(event);
    const note = event.undoOf ? `Undo of the undo: back to version ${saved.restoreVersion}` : `Undo: back to version ${saved.restoreVersion}`;
    const { version } = await republishRevision({ key: saved.key, scope: saved.scope, fromVersion: saved.restoreVersion, expectVersion: saved.atVersion, email: ctx.email, note });
    return {
      after: { version, restoredFrom: saved.restoreVersion },
      summary: `Undid the publish: version ${saved.restoreVersion} is live again as version ${version}`,
      undoData: { key: saved.key, scope: saved.scope, restoreVersion: saved.atVersion, atVersion: version },
    };
  },
};

function readSaved(event: { take<T>(key: string): T }): Saved {
  return { key: event.take<PageKey>("key"), scope: event.take<string>("scope"), restoreVersion: event.take<number>("restoreVersion"), atVersion: event.take<number>("atVersion") };
}

export default handler;
