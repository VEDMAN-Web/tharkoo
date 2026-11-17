import { connectDb } from "@/lib/db";
import type { AdminCtx } from "@/server/admin/context";
import { ForbiddenError, HttpError, ValidationError } from "@/server/http";
import { trashMedia } from "@/server/layout/media-admin";

/**
 * H8.57: move several pictures to the Trash in one go. Each picture goes through the same single write as one at a time
 * (permission, "still in use" check, audit row, its own Undo), so one that a page still uses stays and is named in the answer.
 */

export const BULK_MAX = 100;

export type BulkTrashAnswer = {
  trashed: { id: string; eventId: string }[];
  refused: { id: string; reason: string }[];
};

export async function trashManyMedia(ctx: AdminCtx, ids: string[]): Promise<BulkTrashAnswer> {
  await connectDb();
  if (!Array.isArray(ids) || ids.length === 0) throw new ValidationError("Tick at least one picture.");
  if (ids.length > BULK_MAX) throw new ValidationError(`Choose at most ${BULK_MAX} pictures at a time.`);
  const answer: BulkTrashAnswer = { trashed: [], refused: [] };
  for (const id of [...new Set(ids.map(String))]) {
    try {
      const done = await trashMedia(ctx, id);
      answer.trashed.push({ id, eventId: done.eventId });
    } catch (error) {
      // Not allowed to do this at all is not a per-picture answer.
      if (!(error instanceof HttpError) || error instanceof ForbiddenError) throw error;
      answer.refused.push({ id, reason: error.message });
    }
  }
  return answer;
}
