"use server";

import { revalidatePath } from "next/cache";
import { adminContext } from "@/server/admin/context";
import { HttpError } from "@/server/http";
import { reorderPlaces } from "@/server/locations/reorder";

/** The places of one kind that were moved, in their new order. */
export async function reorderPlacesAction(ids: string[]): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await reorderPlaces(await adminContext(), ids.map(String));
    revalidatePath("/admin/locations/");
    return { ok: true };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}
