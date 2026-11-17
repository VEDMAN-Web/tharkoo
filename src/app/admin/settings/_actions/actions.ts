"use server";

import { revalidatePath } from "next/cache";
import { adminContext, type AdminCtx } from "@/server/admin/context";
import { HttpError } from "@/server/http";
import { setEmergencySwitch } from "@/server/settings/emergency";
import { readRawSite } from "@/server/settings/settings-admin";
import { saveUndoWindows, setPostModeration } from "@/server/settings/settings-admin";

/** H8.25: server actions behind the Settings cards. They answer { ok } and never throw a stack to the browser. */

export type SettingsResult = { ok: true; eventId: string; undoUntil: string | null; summary: string } | { ok: false; message: string };

async function run(work: (ctx: AdminCtx) => Promise<{ eventId: string; undoUntil: string | null; summary: string }>): Promise<SettingsResult> {
  try {
    const done = await work(await adminContext());
    revalidatePath("/admin/settings/");
    return { ok: true, eventId: done.eventId, undoUntil: done.undoUntil, summary: done.summary };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function setEmergencyAction(input: { key: string; on: boolean }): Promise<SettingsResult> {
  return run((ctx) => setEmergencySwitch(ctx, { key: String(input.key), on: input.on }));
}

export async function saveUndoWindowsAction(input: Record<string, unknown>): Promise<SettingsResult> {
  return run((ctx) => saveUndoWindows(ctx, input));
}

/** The raw site record, read only. The role check is on the server (readRawSite), so a hidden button is not the only guard. */
export async function readRawSiteAction(): Promise<{ ok: true; json: string } | { ok: false; message: string }> {
  try {
    const ctx = await adminContext();
    return { ok: true, json: await readRawSite(ctx.roles) };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function setPostModerationAction(input: { on: boolean }): Promise<SettingsResult> {
  return run((ctx) => setPostModeration(ctx, { on: input.on }));
}
