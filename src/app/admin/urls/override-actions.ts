"use server";

import { getStaffFromHeaders } from "@/lib/admin-auth";
import { HttpError } from "@/server/http";
import { assertNoDashes } from "@/server/content/dashes";
import { assertSeoEditor, recordSeo } from "@/app/admin/seo/staff";
import { applyOverrideCsv, deleteUrlOverride, planOverrideCsv, saveUrlOverride } from "@/server/urls/service";
import type { OverrideInput } from "./override-rules";

async function actor() {
  const identity = await getStaffFromHeaders();
  const who = { roles: identity.roles, email: identity.email };
  assertSeoEditor(who);
  return who;
}

function failed(error: unknown) {
  if (error instanceof HttpError) return { ok: false as const, message: error.message, fields: (error.fields ?? {}) as Record<string, string[]> };
  console.error("override action failed", error);
  return { ok: false as const, message: "Something went wrong. Nothing was changed.", fields: {} as Record<string, string[]> };
}

export async function saveOverrideFieldsAction(input: OverrideInput) {
  try {
    const who = await actor();
    assertNoDashes(input as unknown as Record<string, unknown>);
    const out = await saveUrlOverride(input);
    await recordSeo(who, "seo.override.save", "url-override", out.after.path, out.before ?? {}, out.after);
    return { ok: true as const, path: out.after.path };
  } catch (error) {
    return failed(error);
  }
}

export async function deleteOverrideAction(path: string) {
  try {
    const who = await actor();
    const out = await deleteUrlOverride(path);
    await recordSeo(who, "seo.override.delete", "url-override", path, out.before ?? {}, {});
    return { ok: true as const };
  } catch (error) {
    return failed(error);
  }
}

export async function previewOverrideCsvAction(csv: string) {
  try {
    await actor();
    const plan = await planOverrideCsv(String(csv ?? "").slice(0, 400_000));
    return { ok: true as const, rows: plan.rows, fileErrors: plan.fileErrors };
  } catch (error) {
    return failed(error);
  }
}

export async function applyOverrideCsvAction(csv: string) {
  try {
    const who = await actor();
    const out = await applyOverrideCsv(String(csv ?? "").slice(0, 400_000));
    await recordSeo(who, "seo.override.import", "url-override", "csv", {}, out);
    return { ok: true as const, ...out };
  } catch (error) {
    return failed(error);
  }
}
