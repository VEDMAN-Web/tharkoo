"use server";

import { randomUUID } from "node:crypto";
import { assertSuperadmin } from "@/app/admin/seo/staff";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { repairDashes } from "@/server/content/dash-repair";
import { HttpError } from "@/server/http";

/** Superadmin only. Repairs stored site text (not listings); a second run changes nothing. */
export async function repairDashesAction() {
  try {
    const identity = await getStaffFromHeaders();
    assertSuperadmin({ roles: identity.roles, email: identity.email });
    const result = await repairDashes(randomUUID());
    return { ok: true as const, updated: result.updated, collections: result.collections };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false as const, message: error.message };
    console.error("dash repair failed", error);
    return { ok: false as const, message: "Something went wrong. Please try again." };
  }
}
