"use server";

import { revalidatePath } from "next/cache";
import { getStaffFromHeaders, isStaff } from "@/lib/admin-auth";
import { undoAction } from "@/app/admin/undo-actions";
import { AuditEvent } from "@/server/models";
import { ForbiddenError, HttpError } from "@/server/http";
import { removeLiveAd, rejectListing } from "@/server/moderation/decide";

export type DecisionAnswer = { ok: true; eventId: string; undoUntil: string | null; refunded: number } | { ok: false; message: string };
export type UndoAnswer = { ok: true; message: string } | { ok: false; message: string };

async function staff() {
  const identity = await getStaffFromHeaders();
  if (!isStaff(identity)) throw new ForbiddenError("Sign in as staff");
  return identity;
}

async function run(job: () => Promise<{ eventId: string; undoUntil: string | null; refunded: number }>): Promise<DecisionAnswer> {
  try {
    const done = await job();
    revalidatePath("/admin/moderation/");
    return { ok: true, ...done };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}

/** Reject a pending ad. `refund` gives back the posting fee of a paid ad and does nothing for a free one. */
export async function rejectAdAction(input: { id: string; reason: string; refund: boolean }): Promise<DecisionAnswer> {
  return run(async () => {
    const who = await staff();
    return rejectListing({ id: String(input.id), roles: who.roles, email: who.email, reason: String(input.reason ?? ""), refund: input.refund === true });
  });
}

/** Take a live ad down. `refund` gives back the posting fee of a paid ad and does nothing for a free one. */
export async function removeAdAction(input: { id: string; reason: string; refund: boolean }): Promise<DecisionAnswer> {
  return run(async () => {
    const who = await staff();
    return removeLiveAd({ id: String(input.id), roles: who.roles, email: who.email, reason: String(input.reason ?? ""), refund: input.refund === true });
  });
}

/** Undo a decision. The answer carries the line the undo wrote, so the screen can say whether credits were taken back. */
export async function undoDecisionAction(eventId: string): Promise<UndoAnswer> {
  const outcome = await undoAction(String(eventId));
  if (!outcome.ok) return { ok: false, message: outcome.message };
  const row = await AuditEvent.findById(outcome.eventId).select("summary").lean<{ summary?: string } | null>();
  revalidatePath("/admin/moderation/");
  return { ok: true, message: row?.summary ?? "Decision undone." };
}
