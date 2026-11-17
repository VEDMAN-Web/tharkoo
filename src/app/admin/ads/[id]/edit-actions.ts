"use server";

import { revalidatePath } from "next/cache";
import { undoAction } from "@/app/admin/undo-actions";
import { adminContext } from "@/server/admin/context";
import { HttpError } from "@/server/http";
import { restoreAdVersion, saveStaffEdit } from "@/server/listings/staff-edit";

export type EditAnswer = { ok: true; changed: boolean; title: string; eventId: string } | { ok: false; message: string; fields?: Record<string, string[]> };
export type PlainAnswer = { ok: boolean; message: string };

function failed(error: unknown): { ok: false; message: string; fields?: Record<string, string[]> } {
  if (error instanceof HttpError) return { ok: false, message: error.message, fields: error.fields };
  throw error;
}

export async function saveAdEditAction(input: { id: string; values: { title: unknown; description: unknown; price: unknown; attributes: unknown } }): Promise<EditAnswer> {
  try {
    const done = await saveStaffEdit(await adminContext(), String(input.id), input.values);
    revalidatePath("/admin/ads/");
    return { ok: true, changed: done.changed, title: done.title, eventId: done.eventId };
  } catch (error) {
    return failed(error);
  }
}

export async function restoreAdVersionAction(input: { id: string; version: number }): Promise<EditAnswer> {
  try {
    const done = await restoreAdVersion(await adminContext(), String(input.id), Number(input.version));
    revalidatePath("/admin/ads/");
    return { ok: true, changed: done.changed, title: done.title, eventId: done.eventId };
  } catch (error) {
    return failed(error);
  }
}

export async function undoAdEditAction(eventId: string): Promise<PlainAnswer> {
  const outcome = await undoAction(String(eventId));
  revalidatePath("/admin/ads/");
  return outcome.ok ? { ok: true, message: "Undone. The old values are back as a new version." } : { ok: false, message: outcome.message };
}
