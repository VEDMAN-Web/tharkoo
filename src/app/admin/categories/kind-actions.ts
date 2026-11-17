"use server";

import { revalidatePath } from "next/cache";
import { undoAction } from "@/app/admin/undo-actions";
import { adminContext } from "@/server/admin/context";
import { createKind, removeKind, updateKind, type KindInput } from "@/server/categories/kinds";
import { HttpError } from "@/server/http";

export type KindAnswer = { ok: true; message: string; eventId: string } | { ok: false; message: string };

async function run(work: () => Promise<{ eventId: string }>, message: string): Promise<KindAnswer> {
  try {
    const done = await work();
    revalidatePath("/admin/categories/");
    return { ok: true, message, eventId: done.eventId };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function createKindAction(input: KindInput): Promise<KindAnswer> {
  return run(async () => createKind(await adminContext(), input), "Kind added.");
}

export async function updateKindAction(key: string, input: KindInput): Promise<KindAnswer> {
  return run(async () => updateKind(await adminContext(), String(key), input), "Kind saved.");
}

export async function removeKindAction(key: string): Promise<KindAnswer> {
  return run(async () => removeKind(await adminContext(), String(key)), "Kind removed.");
}

export async function undoKindAction(eventId: string): Promise<{ ok: boolean; message: string }> {
  const outcome = await undoAction(String(eventId));
  revalidatePath("/admin/categories/");
  return outcome.ok ? { ok: true, message: "Undone." } : { ok: false, message: outcome.message };
}
