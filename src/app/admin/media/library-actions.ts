"use server";

import { revalidatePath } from "next/cache";
import { undoAction } from "@/app/admin/undo-actions";
import { adminContext } from "@/server/admin/context";
import { HttpError } from "@/server/http";
import { restoreMedia, saveMediaDetails, trashMedia, type MediaDetailsInput } from "@/server/layout/media-admin";
import { trashManyMedia } from "@/server/layout/media-bulk";

export type SaveAnswer = { ok: true; changed: boolean; eventId: string } | { ok: false; message: string; fields?: Record<string, string[]> };
export type PlainAnswer = { ok: boolean; message: string; eventId?: string };

function failed(error: unknown): { ok: false; message: string; fields?: Record<string, string[]> } {
  if (error instanceof HttpError) return { ok: false, message: error.message, fields: error.fields };
  throw error;
}

export async function saveMediaDetailsAction(input: { id: string } & MediaDetailsInput): Promise<SaveAnswer> {
  try {
    const done = await saveMediaDetails(await adminContext(), String(input.id), { alt: input.alt, phoneMediaId: input.phoneMediaId ? String(input.phoneMediaId) : null, focusX: input.focusX, focusY: input.focusY });
    revalidatePath("/admin/media/");
    return { ok: true, changed: done.changed, eventId: done.eventId };
  } catch (error) {
    return failed(error);
  }
}

export async function trashMediaAction(id: string): Promise<PlainAnswer> {
  try {
    const done = await trashMedia(await adminContext(), String(id));
    revalidatePath("/admin/media/");
    return { ok: true, message: "Moved to the Trash. It is removed for good in 30 days.", eventId: done.eventId };
  } catch (error) {
    const answer = failed(error);
    return { ok: false, message: answer.message };
  }
}

export async function restoreMediaAction(id: string): Promise<PlainAnswer> {
  try {
    const done = await restoreMedia(await adminContext(), String(id));
    revalidatePath("/admin/media/");
    return { ok: true, message: "Taken out of the Trash.", eventId: done.eventId };
  } catch (error) {
    const answer = failed(error);
    return { ok: false, message: answer.message };
  }
}

export async function undoMediaAction(eventId: string): Promise<PlainAnswer> {
  const outcome = await undoAction(String(eventId));
  revalidatePath("/admin/media/");
  return outcome.ok ? { ok: true, message: "Undone." } : { ok: false, message: outcome.message };
}

export type BulkAnswer = { ok: true; trashed: number; eventIds: string[]; refused: { id: string; reason: string }[] } | { ok: false; message: string };

/** Moves the ticked pictures to the Trash. A picture that a page still uses stays, and comes back in `refused` with the reason. */
export async function trashManyMediaAction(ids: string[]): Promise<BulkAnswer> {
  try {
    const done = await trashManyMedia(await adminContext(), ids.map(String));
    revalidatePath("/admin/media/");
    return { ok: true, trashed: done.trashed.length, eventIds: done.trashed.map((row) => row.eventId), refused: done.refused };
  } catch (error) {
    const answer = failed(error);
    return { ok: false, message: answer.message };
  }
}

/** Undoes every picture of one bulk move. */
export async function undoManyMediaAction(eventIds: string[]): Promise<PlainAnswer> {
  let undone = 0;
  for (const id of eventIds.slice(0, 100)) {
    const outcome = await undoAction(String(id));
    if (outcome.ok) undone += 1;
  }
  revalidatePath("/admin/media/");
  return undone === eventIds.length ? { ok: true, message: `Put ${undone} ${undone === 1 ? "picture" : "pictures"} back.` } : { ok: false, message: `Put ${undone} of ${eventIds.length} back. The rest cannot be undone any more.` };
}
