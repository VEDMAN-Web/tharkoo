"use server";

import { revalidatePath } from "next/cache";
import { undoAction } from "@/app/admin/undo-actions";
import { adminContext } from "@/server/admin/context";
import { HttpError } from "@/server/http";
import { decideVerificationWithUndo, reopenVerification } from "@/server/verification/service";

export type DecideAnswer = { ok: true; eventId: string; undoUntil: string | null; status: "approved" | "rejected" } | { ok: false; message: string };
export type SimpleAnswer = { ok: boolean; message: string };

export async function decideIdAction(input: { id: string; decision: "approved" | "rejected"; reason: string }): Promise<DecideAnswer> {
  try {
    const ctx = await adminContext();
    const done = await decideVerificationWithUndo(ctx.actorId, ctx.roles, String(input.id), input.decision === "rejected" ? "rejected" : "approved", String(input.reason ?? "").trim(), ctx.requestId);
    revalidatePath("/admin/kyc/");
    return { ok: true, ...done };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function reopenIdAction(id: string): Promise<SimpleAnswer> {
  try {
    await reopenVerification(await adminContext(), String(id));
    revalidatePath("/admin/kyc/");
    return { ok: true, message: "Reopened. The check is waiting again and the verified badge is off." };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function undoIdAction(eventId: string): Promise<SimpleAnswer> {
  const outcome = await undoAction(String(eventId));
  revalidatePath("/admin/kyc/");
  return outcome.ok ? { ok: true, message: "Decision undone. The check is waiting again." } : { ok: false, message: outcome.message };
}
