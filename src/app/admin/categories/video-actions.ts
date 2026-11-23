"use server";

import { adminContext } from "@/server/admin/context";
import { updateVideoTourSettings } from "@/server/tours/service";
import type { ManageResult } from "./manage-actions";

/**
 * H19.8: the video call switch and price saved from the category form. It is the same server function the Video tours page
 * uses (superadmin only, the people and kind rules, the lowest price, an audit row), so there is one value and one set of rules.
 */
export async function saveCategoryVideoAction(categoryId: string, input: { enabled: boolean; coins: number }): Promise<ManageResult<{ enabled: boolean; coins: number }>> {
  try {
    const ctx = await adminContext();
    const saved = await updateVideoTourSettings({ actorId: ctx.actorId, roles: ctx.roles, categoryId, enabled: input.enabled, coins: input.coins, requestId: ctx.requestId });
    return { ok: true, data: { enabled: saved.videoTourEnabled, coins: saved.videoTourCoins } };
  } catch (error) {
    const fields = (error as { fields?: Record<string, string[]> }).fields;
    const first = fields ? Object.values(fields).flat()[0] : "";
    return { ok: false, message: first || (error instanceof Error ? error.message : "Save failed") };
  }
}
