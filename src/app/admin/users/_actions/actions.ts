"use server";

import { revalidatePath } from "next/cache";
import { adminContext, type AdminCtx } from "@/server/admin/context";
import { banPreview, banUser, logoutEverywhere, unbanUser, type UserActionResult } from "@/server/admin/user-actions";
import { can } from "@/lib/admin/perms";
import { HttpError } from "@/server/http";

/** H8.11: server actions behind the Users drawer buttons. Each one answers { ok } and never throws a stack to the browser. */

export type ActionResult = { ok: true; eventId: string; undoUntil: string | null; summary: string } | { ok: false; message: string };
export type PreviewResult = { ok: true; liveAds: number; sessions: number } | { ok: false; message: string };

async function run(work: (ctx: AdminCtx) => Promise<UserActionResult>): Promise<ActionResult> {
  try {
    const ctx = await adminContext();
    const done = await work(ctx);
    revalidatePath("/admin/users/");
    return { ok: true, ...done };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function banUserAction(input: { userId: string; reason: string }): Promise<ActionResult> {
  return run((ctx) => banUser(ctx, { userId: String(input.userId), reason: String(input.reason ?? "") }));
}

export async function unbanUserAction(input: { userId: string }): Promise<ActionResult> {
  return run((ctx) => unbanUser(ctx, { userId: String(input.userId) }));
}

export async function logoutEverywhereAction(input: { userId: string }): Promise<ActionResult> {
  return run((ctx) => logoutEverywhere(ctx, { userId: String(input.userId) }));
}

/** What a ban would pause, shown in the dialog before the person confirms. Needs the ban permission. */
export async function banPreviewAction(userId: string): Promise<PreviewResult> {
  try {
    const ctx = await adminContext();
    if (!can(ctx.roles, "users.ban")) return { ok: false, message: "You do not have permission to do this" };
    return { ok: true, ...(await banPreview(String(userId))) };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}
