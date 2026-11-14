"use server";

import { randomUUID } from "node:crypto";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { HttpError } from "@/server/http";
import { actorForStaff, createAdminAd, type AdminAdInput } from "@/server/listings/admin-create";

export type CreateAdResult = { ok: true; id: string; status: "pending" | "active" } | { ok: false; error: string };

/** Creates one ad for the staff account or a chosen user. Every check runs on the server. */
export async function createAdAction(input: AdminAdInput): Promise<CreateAdResult> {
  const actor = await actorForStaff(await getStaffFromHeaders());
  if (!actor) return { ok: false, error: "Sign in again as an admin" };
  try {
    const created = await createAdminAd(actor, input, randomUUID());
    return { ok: true, id: created.id, status: created.status };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("admin create ad failed", error);
    return { ok: false, error: "The ad was not created. Nothing was saved." };
  }
}
