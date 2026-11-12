"use server";

import { getStaffFromHeaders } from "@/lib/admin-auth";
import { HttpError } from "@/server/http";
import { submitManual } from "@/server/indexnow/manual";
import { saveIndexing, type IndexingSettings } from "@/server/seo/indexing";

async function actor() {
  const identity = await getStaffFromHeaders();
  return { roles: identity.roles, email: identity.email };
}

function failed(error: unknown) {
  if (error instanceof HttpError) return { ok: false as const, message: error.message, fields: (error.fields ?? {}) as Record<string, string[]> };
  console.error("indexing action failed", error);
  return { ok: false as const, message: "Something went wrong. Nothing was changed.", fields: {} as Record<string, string[]> };
}

export async function saveIndexingAction(settings: IndexingSettings) {
  try {
    return { ok: true as const, settings: await saveIndexing(await actor(), settings) };
  } catch (error) {
    return failed(error);
  }
}

export async function submitIndexNowAction(urls: string) {
  try {
    return { ok: true as const, ...(await submitManual(await actor(), urls)) };
  } catch (error) {
    return failed(error);
  }
}
