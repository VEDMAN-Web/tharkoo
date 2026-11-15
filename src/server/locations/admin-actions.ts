"use server";

import { getStaffFromHeaders } from "@/lib/admin-auth";
import { createPlace, deletePlace, updatePlace, type PlaceInput } from "@/server/locations/manage";
import { connectDb } from "@/lib/db";

async function actor() {
  const who = await getStaffFromHeaders();
  return { email: who.email, roles: who.roles };
}

function failed(error: unknown) {
  return { ok: false as const, message: error instanceof Error ? error.message : "Save failed" };
}

export async function createPlaceAction(input: PlaceInput) {
  await connectDb();
  try {
    return { ok: true as const, ...(await createPlace(await actor(), input)) };
  } catch (error) {
    return failed(error);
  }
}

export async function updatePlaceAction(id: string, input: PlaceInput) {
  await connectDb();
  try {
    return await updatePlace(await actor(), id, input);
  } catch (error) {
    return failed(error);
  }
}

export async function deletePlaceAction(id: string) {
  await connectDb();
  try {
    return await deletePlace(await actor(), id);
  } catch (error) {
    return failed(error);
  }
}
