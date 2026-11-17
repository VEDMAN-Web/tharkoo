"use server";

import { revalidatePath } from "next/cache";
import { undoAction } from "@/app/admin/undo-actions";
import { isRecordKind, KINDS } from "@/lib/admin/record-kinds";
import { adminContext } from "@/server/admin/context";
import { deleteRecord, saveRawRecord, saveRecord } from "@/server/admin/records";
import { HttpError, ValidationError } from "@/server/http";

export type SaveAnswer = { ok: true; id: string; created: boolean; name: string; eventId: string } | { ok: false; message: string; fields?: Record<string, string[]> };
export type PlainAnswer = { ok: boolean; message: string };

function kindOf(value: unknown) {
  const text = String(value ?? "");
  if (!isRecordKind(text)) throw new ValidationError("Unknown screen");
  return text;
}

function failed(error: unknown): { ok: false; message: string; fields?: Record<string, string[]> } {
  if (error instanceof HttpError) return { ok: false, message: error.message, fields: error.fields };
  throw error;
}

export async function saveRecordAction(input: { kind: string; id?: string; values: unknown }): Promise<SaveAnswer> {
  try {
    const kind = kindOf(input.kind);
    const done = await saveRecord(await adminContext(), kind, { id: input.id ? String(input.id) : undefined, values: input.values });
    revalidatePath(KINDS[kind].path);
    return { ok: true, id: done.id, created: done.created, name: done.name, eventId: done.eventId };
  } catch (error) {
    return failed(error);
  }
}

export async function saveRawRecordAction(input: { kind: string; id: string; raw: string }): Promise<SaveAnswer> {
  try {
    const kind = kindOf(input.kind);
    const done = await saveRawRecord(await adminContext(), kind, String(input.id), String(input.raw ?? ""));
    revalidatePath(KINDS[kind].path);
    return { ok: true, id: done.id, created: false, name: done.name, eventId: done.eventId };
  } catch (error) {
    return failed(error);
  }
}

export async function deleteRecordAction(input: { kind: string; id: string }): Promise<PlainAnswer & { name?: string }> {
  try {
    const kind = kindOf(input.kind);
    const done = await deleteRecord(await adminContext(), kind, String(input.id));
    revalidatePath(KINDS[kind].path);
    return { ok: true, message: `Deleted ${done.name}.`, name: done.name };
  } catch (error) {
    return failed(error);
  }
}

export async function undoRecordAction(input: { kind: string; eventId: string }): Promise<PlainAnswer> {
  const kind = kindOf(input.kind);
  const outcome = await undoAction(String(input.eventId));
  revalidatePath(KINDS[kind].path);
  return outcome.ok ? { ok: true, message: "Undone. The old values are back." } : { ok: false, message: outcome.message };
}
