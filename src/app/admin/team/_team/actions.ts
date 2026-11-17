"use server";

import { revalidatePath } from "next/cache";
import { adminContext } from "@/server/admin/context";
import { changeRoles, inviteStaff, removeAccess, resendInvite } from "@/server/admin/team";
import { HttpError } from "@/server/http";

/** H8.46: server actions behind Team and roles. Each answers { ok } and never throws a stack to the browser. */

export type TeamResult = { ok: true; eventId: string; undoUntil: string | null; summary: string; emailed?: boolean } | { ok: false; message: string };

async function run(work: (ctx: Awaited<ReturnType<typeof adminContext>>) => Promise<{ eventId: string; undoUntil: string | null; summary: string; emailed?: boolean }>): Promise<TeamResult> {
  try {
    const ctx = await adminContext();
    const done = await work(ctx);
    revalidatePath("/admin/team/");
    return { ok: true, eventId: done.eventId, undoUntil: done.undoUntil, summary: done.summary, emailed: done.emailed };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function inviteStaffAction(input: { name: string; email: string; roles: string[]; reason?: string }): Promise<TeamResult> {
  return run((ctx) => inviteStaff(ctx, { name: String(input.name ?? ""), email: String(input.email ?? ""), roles: input.roles, reason: input.reason }));
}

export async function changeRolesAction(input: { userId: string; roles: string[]; reason?: string }): Promise<TeamResult> {
  return run((ctx) => changeRoles(ctx, { userId: String(input.userId), roles: input.roles, reason: input.reason }));
}

export async function removeAccessAction(input: { userId: string; reason?: string }): Promise<TeamResult> {
  return run((ctx) => removeAccess(ctx, { userId: String(input.userId), reason: input.reason }));
}

export async function resendInviteAction(input: { userId: string }): Promise<TeamResult> {
  return run((ctx) => resendInvite(ctx, { userId: String(input.userId) }));
}
