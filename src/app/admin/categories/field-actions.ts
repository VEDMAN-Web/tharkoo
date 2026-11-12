"use server";

import { getStaffFromHeaders, isStaff } from "@/lib/admin-auth";
import { ForbiddenError, HttpError } from "@/server/http";
import { updateCategoryFields, type FieldEdit } from "./fields-service";

export type SaveFieldsResult = { ok: true } | { ok: false; error: string };

/** Saves the post-form fields of one category. The server checks the role again; the screen's own check is only a courtesy. */
export async function saveCategoryFieldsAction(slug: string, edits: FieldEdit[]): Promise<SaveFieldsResult> {
  try {
    const who = await getStaffFromHeaders();
    if (!isStaff(who)) throw new ForbiddenError("Sign in as staff to edit post fields");
    await updateCategoryFields({ slug, edits, email: who.email, roles: who.roles });
    return { ok: true };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("category fields action failed", error);
    return { ok: false, error: "Something went wrong. Nothing was changed." };
  }
}
