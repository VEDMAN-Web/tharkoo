"use server";

import { revalidatePath } from "next/cache";
import { undoAction } from "@/app/admin/undo-actions";
import type { PictureAnswer, PictureItem, UndoAnswer } from "@/app/admin/_catalog/CatalogPictures";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { can } from "@/lib/admin/perms";
import { adminContext } from "@/server/admin/context";
import { HttpError } from "@/server/http";
import type { PictureInput } from "@/server/layout/catalog-pictures";
import { findPlacesForPictures, setPlacePictures } from "@/server/locations/manage";

export async function savePlacePicturesAction(input: { id: string } & PictureInput): Promise<PictureAnswer> {
  try {
    const done = await setPlacePictures(await adminContext(), String(input.id), { photo: input.photo ?? null, band: input.band ?? null });
    revalidatePath("/admin/locations/");
    return { ok: true, message: `Saved the pictures of ${done.name}.`, eventId: done.eventId };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function undoPlacePicturesAction(eventId: string): Promise<UndoAnswer> {
  const outcome = await undoAction(String(eventId));
  revalidatePath("/admin/locations/");
  return outcome.ok ? { ok: true, message: "Undone. The old pictures are back." } : { ok: false, message: outcome.message };
}

export async function searchPlacesAction(query: string): Promise<PictureItem[]> {
  const identity = await getStaffFromHeaders();
  if (!can(identity.roles, "catalogue.edit")) return [];
  return findPlacesForPictures(String(query ?? ""));
}
