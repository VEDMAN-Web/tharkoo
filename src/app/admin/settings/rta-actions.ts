"use server";

import { revalidatePath } from "next/cache";
import { adminContext } from "@/server/admin/context";
import { HttpError } from "@/server/http";
import { saveRtaLabel } from "@/server/settings/rta-label";

export type RtaResult = { ok: true; on: boolean; summary: string } | { ok: false; message: string };

/** H17.13: an admin turns the RTA label on or off. The role check and the audit entry are on the server. */
export async function saveRtaLabelAction(on: boolean): Promise<RtaResult> {
  try {
    const done = await saveRtaLabel(await adminContext(), { on });
    revalidatePath("/admin/settings/");
    return { ok: true, on: done.on, summary: done.summary };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}
