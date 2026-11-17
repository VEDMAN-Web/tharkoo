"use server";

import { adminContext } from "@/server/admin/context";
import { markNotJunk, tickChecklist } from "@/server/admin/launch-checklist";
import { ForbiddenError, HttpError, UnauthorizedError } from "@/server/http";

export type TickResult = { ok: true; eventId: string } | { ok: false; message: string };

export async function tickChecklistAction(key: string, done: boolean): Promise<TickResult> {
  try {
    const written = await tickChecklist(await adminContext(), key, done);
    return { ok: true, eventId: written.eventId };
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError || error instanceof HttpError) return { ok: false, message: error.message };
    console.error("launch checklist tick failed", error);
    return { ok: false, message: "Nothing was saved. Try again." };
  }
}

/** "Not junk" for the ad the checklist names. */
export async function notJunkAction(listingId: string): Promise<TickResult> {
  try {
    const written = await markNotJunk(await adminContext(), String(listingId), true);
    return { ok: true, eventId: written.eventId };
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError || error instanceof HttpError) return { ok: false, message: error.message };
    console.error("launch checklist not-junk failed", error);
    return { ok: false, message: "Nothing was saved. Try again." };
  }
}
