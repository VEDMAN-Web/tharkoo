"use server";

import { revalidatePath } from "next/cache";
import { undoAction } from "@/app/admin/undo-actions";
import { adminContext } from "@/server/admin/context";
import { actOnReports, type ReportAction, type ReportTab } from "@/server/admin/reports";
import { HttpError } from "@/server/http";

export type ActAnswer = { ok: true; eventIds: string[]; undoUntil: string | null; summary: string } | { ok: false; message: string };
export type UndoAnswer = { ok: boolean; message: string };

export async function reportActAction(input: { tab: ReportTab; id: string; action: ReportAction; note: string; refund: boolean }): Promise<ActAnswer> {
  try {
    const done = await actOnReports(await adminContext(), { tab: input.tab, id: String(input.id), action: input.action, note: String(input.note ?? ""), refund: input.refund === true });
    revalidatePath("/admin/reports/");
    return { ok: true, ...done };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}

/** Undo every step of one decision, last step first (ban, then the reports, then the ad). */
export async function undoReportAction(eventIds: string[]): Promise<UndoAnswer> {
  const done: string[] = [];
  for (const id of [...eventIds].reverse()) {
    const outcome = await undoAction(String(id));
    if (!outcome.ok) return { ok: false, message: done.length ? `${done.join(". ")}. Then: ${outcome.message}` : outcome.message };
    done.push("Undone");
  }
  revalidatePath("/admin/reports/");
  return { ok: true, message: eventIds.length > 1 ? "Decision undone: the ad, the reports and the ban are back as they were." : "Decision undone." };
}
