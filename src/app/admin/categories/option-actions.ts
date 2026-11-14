"use server";

import { getStaffFromHeaders, isStaff } from "@/lib/admin-auth";
import {
  addFieldOptions,
  listFieldOptions,
  removeFieldOption,
  type AddOptionsResult,
  type OptionPage,
} from "@/server/fields/service";
import { ForbiddenError, HttpError } from "@/server/http";
import { addCategoryField, type FieldKind } from "./fields-service";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Runs one admin write or read. The server checks the role here and again inside the service. */
async function run<T>(work: (actor: { email: string; roles: string[] }) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const who = await getStaffFromHeaders();
    if (!isStaff(who)) throw new ForbiddenError("Sign in as staff to change post fields");
    return { ok: true, data: await work({ email: who.email, roles: who.roles }) };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("category field action failed", error);
    return { ok: false, error: "Something went wrong. Nothing was changed." };
  }
}

/** One page of a field's option list, for the admin screen. */
export async function listFieldOptionsAction(
  slug: string,
  fieldKey: string,
  input: { q?: string; offset?: number; limit?: number },
): Promise<ActionResult<OptionPage>> {
  return run((actor) => listFieldOptions({ categorySlug: slug, fieldKey, ...input }, actor));
}

/** Adds options from a pasted list ("paste") or the first column of a CSV file ("csv"). */
export async function addFieldOptionsAction(
  slug: string,
  fieldKey: string,
  text: string,
  source: "paste" | "csv",
): Promise<ActionResult<AddOptionsResult>> {
  return run((actor) => addFieldOptions({ categorySlug: slug, fieldKey, text, source, actor }));
}

/** Removes one option from a field's list. Ads that already use it keep their value. */
export async function removeFieldOptionAction(slug: string, fieldKey: string, value: string): Promise<ActionResult<{ total: number }>> {
  return run((actor) => removeFieldOption({ categorySlug: slug, fieldKey, value, actor }));
}

/** Adds a field to the end of the post-ad form. It starts switched off, so an admin adds its options first. */
export async function addCategoryFieldAction(slug: string, label: string, kind: FieldKind): Promise<ActionResult<{ key: string; type: string }>> {
  return run((actor) => addCategoryField({ slug, label, kind, email: actor.email, roles: actor.roles }));
}
