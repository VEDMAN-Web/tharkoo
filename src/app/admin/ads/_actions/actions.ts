"use server";

import { revalidatePath } from "next/cache";
import { adminContext } from "@/server/admin/context";
import { BULK_ACTIONS, bulkChangeAds, undoAdsBatch, type BulkAction, type BulkSkip } from "@/server/admin/ads-bulk";
import { HttpError } from "@/server/http";

export type BulkAnswer = { ok: true; batchId: string; changed: number; skipped: BulkSkip[]; eventIds: string[] } | { ok: false; message: string };
export type BatchUndoAnswer = { ok: boolean; message: string };

export async function bulkAdsAction(input: { action: string; ids: string[]; reason?: string; confirm?: string; hours?: number; endsAt?: string }): Promise<BulkAnswer> {
  try {
    const action = BULK_ACTIONS.find((item) => item === input.action) as BulkAction | undefined;
    if (!action) return { ok: false, message: "Choose what to do with the ads." };
    const done = await bulkChangeAds(await adminContext(), { action, ids: Array.isArray(input.ids) ? input.ids.map(String) : [], reason: String(input.reason ?? ""), confirm: String(input.confirm ?? ""), hours: input.hours === undefined ? undefined : Number(input.hours), endsAt: input.endsAt === undefined ? undefined : String(input.endsAt) });
    revalidatePath("/admin/ads/");
    return { ok: true, ...done };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function undoAdsBatchAction(input: { batchId: string; eventIds: string[] }): Promise<BatchUndoAnswer> {
  try {
    const done = await undoAdsBatch(await adminContext(), { batchId: String(input.batchId), eventIds: Array.isArray(input.eventIds) ? input.eventIds.map(String) : [] });
    revalidatePath("/admin/ads/");
    if (done.failed.length === 0) return { ok: true, message: `Undone. ${done.restored} ${done.restored === 1 ? "ad is" : "ads are"} back as before.` };
    return { ok: done.restored > 0, message: `${done.restored} undone, ${done.failed.length} could not be: ${done.failed[0]}` };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}
