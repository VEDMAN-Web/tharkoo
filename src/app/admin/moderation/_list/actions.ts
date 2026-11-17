"use server";

import { revalidatePath } from "next/cache";
import { adminContext } from "@/server/admin/context";
import { HttpError } from "@/server/http";
import { markChecked } from "@/server/moderation/review";

export type CheckResult = { ok: true } | { ok: false; message: string };

export async function markCheckedAction(id: string): Promise<CheckResult> {
  try {
    await markChecked(await adminContext(), String(id));
    revalidatePath("/admin/moderation/");
    return { ok: true };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}
