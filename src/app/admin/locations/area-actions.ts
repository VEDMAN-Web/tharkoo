"use server";

import { revalidatePath } from "next/cache";
import { adminContext } from "@/server/admin/context";
import { HttpError } from "@/server/http";
import { createArea, removeArea, updateArea } from "@/server/locations/areas";

type Answer<T = object> = ({ ok: true } & T) | { ok: false; message: string };

async function run<T extends object>(work: () => Promise<T>): Promise<Answer<T>> {
  try {
    const done = await work();
    revalidatePath("/admin/locations/");
    return { ok: true, ...done };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function createAreaAction(input: { parentId: string; name: string; slug?: string }) {
  return run(async () => createArea(await adminContext(), input));
}

/** Rename or hide or show. The answer carries the event, so the screen can offer Undo. */
export async function updateAreaAction(id: string, input: { name?: string; enabled?: boolean }) {
  return run(async () => updateArea(await adminContext(), String(id), input));
}

export async function removeAreaAction(id: string) {
  return run(async () => removeArea(await adminContext(), String(id)));
}
