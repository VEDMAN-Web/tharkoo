"use server";

import { revalidatePath } from "next/cache";
import { undoAction } from "@/app/admin/undo-actions";
import { adminContext } from "@/server/admin/context";
import { HttpError } from "@/server/http";
import { restoreMedia, saveMediaDetails, trashMedia, type MediaDetailsInput } from "@/server/layout/media-admin";

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
