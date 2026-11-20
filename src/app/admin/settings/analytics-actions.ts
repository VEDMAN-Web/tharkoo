"use server";

import { revalidatePath } from "next/cache";
import { adminContext } from "@/server/admin/context";
import { HttpError } from "@/server/http";
import { saveGoogleAnalyticsId } from "@/server/settings/analytics";

export type AnalyticsResult = { ok: true; id: string; summary: string } | { ok: false; message: string };

/** H17.11: an admin sets or clears the Google Analytics ID. The role check, the strict ID check and the audit entry are on the server. */
export async function saveGoogleAnalyticsIdAction(id: string): Promise<AnalyticsResult> {
  try {
    const done = await saveGoogleAnalyticsId(await adminContext(), { id });
    revalidatePath("/admin/settings/");
    return { ok: true, id: done.id, summary: done.summary };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}
