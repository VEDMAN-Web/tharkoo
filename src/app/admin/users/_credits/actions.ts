"use server";

import { revalidatePath } from "next/cache";
import { adminContext } from "@/server/admin/context";
import { adjustCredits } from "@/server/billing/staff-credits";
import { HttpError } from "@/server/http";

/** H8.14: the server action behind "Add or remove credits". It answers { ok } and never throws a stack to the browser. */

export type AdjustActionResult = { ok: true; eventId: string; undoUntil: string | null; summary: string; balance: number } | { ok: false; message: string };

export async function adjustCreditsAction(input: { userId: string; amount: number; reason: string; requestKey: string }): Promise<AdjustActionResult> {
  try {
    const ctx = await adminContext();
    const done = await adjustCredits(ctx, {
      userId: String(input.userId),
      amount: Number(input.amount),
      reason: String(input.reason ?? ""),
      requestKey: String(input.requestKey ?? ""),
    });
    revalidatePath("/admin/users/");
    return { ok: true, ...done };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}
