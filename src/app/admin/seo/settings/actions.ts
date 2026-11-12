"use server";

import { getStaffFromHeaders } from "@/lib/admin-auth";
import { HttpError } from "@/server/http";
import { adsSkippedBySchema, saveSeoSettings } from "./store";
import type { SeoSettings } from "./rules";
import type { AdSchemaMapping } from "@/lib/seo/schema";
import { assertSeoEditor } from "@/app/admin/seo/staff";

async function actor() {
  const identity = await getStaffFromHeaders();
  return { roles: identity.roles, email: identity.email };
}

function failed(error: unknown) {
  if (error instanceof HttpError) return { ok: false as const, message: error.message, fields: (error.fields ?? {}) as Record<string, string[]> };
  console.error("seo settings action failed", error);
  return { ok: false as const, message: "Something went wrong. Nothing was changed.", fields: {} as Record<string, string[]> };
}

export async function saveSeoSettingsAction(settings: SeoSettings) {
  try {
    return { ok: true as const, settings: await saveSeoSettings(await actor(), settings) };
  } catch (error) {
    return failed(error);
  }
}

export async function checkAdSchemaAction(categoryId: string, mapping: AdSchemaMapping) {
  try {
    assertSeoEditor(await actor());
    if (!/^[a-f0-9]{24}$/i.test(categoryId)) return { ok: false as const, message: "Choose a category", fields: {} as Record<string, string[]> };
    return { ok: true as const, ...(await adsSkippedBySchema(categoryId, mapping)) };
  } catch (error) {
    return failed(error);
  }
}
