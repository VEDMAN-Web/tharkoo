"use server";

import { revalidatePath } from "next/cache";
import { undoAction } from "@/app/admin/undo-actions";
import type { PictureAnswer, UndoAnswer } from "@/app/admin/_catalog/CatalogPictures";
import { adminContext } from "@/server/admin/context";
import { setCategoryPictures } from "@/server/categories/manage";
import { HttpError } from "@/server/http";
import type { PictureInput } from "@/server/layout/catalog-pictures";

export async function saveCategoryPicturesAction(input: { id: string } & PictureInput): Promise<PictureAnswer> {
  try {
    const done = await setCategoryPictures(await adminContext(), String(input.id), { photo: input.photo ?? null, band: input.band ?? null });
    revalidatePath("/admin/categories/");
    return { ok: true, message: `Saved the pictures of ${done.name}.`, eventId: done.eventId };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function undoCategoryPicturesAction(eventId: string): Promise<UndoAnswer> {
  const outcome = await undoAction(String(eventId));
  revalidatePath("/admin/categories/");
  return outcome.ok ? { ok: true, message: "Undone. The old pictures are back." } : { ok: false, message: outcome.message };
}
