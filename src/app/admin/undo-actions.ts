"use server";

import { adminContext } from "@/server/admin/context";
import { undoEvent, type UndoOutcome } from "@/server/admin/undo/core";
import { ForbiddenError, UnauthorizedError } from "@/server/http";

export async function undoAction(eventId: string): Promise<UndoOutcome> {
  try {
    const ctx = await adminContext();
    return await undoEvent(ctx, eventId);
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      return { ok: false, reason: "not_allowed", message: error.message };
    }
    throw error;
  }
}
