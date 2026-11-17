"use server";

import { adminContext } from "@/server/admin/context";
import { tickChecklist } from "@/server/admin/launch-checklist";
import { ForbiddenError, HttpError, UnauthorizedError } from "@/server/http";

export type TickResult = { ok: true } | { ok: false; message: string };

export async function tickChecklistAction(key: string, done: boolean): Promise<TickResult> {
  try {
    await tickChecklist(await adminContext(), key, done);
    return { ok: true };
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError || error instanceof HttpError) return { ok: false, message: error.message };
    console.error("launch checklist tick failed", error);
    return { ok: false, message: "Nothing was saved. Try again." };
  }
}
