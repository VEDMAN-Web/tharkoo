"use server";

import { revalidatePath } from "next/cache";
import { adminContext } from "@/server/admin/context";
import { addTakedown, type TakedownInput } from "@/server/admin/takedown";
import { HttpError } from "@/server/http";

export type TakedownAnswer = { ok: true; id: string } | { ok: false; message: string };

/** Adds a legal takedown request that arrived outside the site. */
export async function addTakedownAction(input: TakedownInput): Promise<TakedownAnswer> {
  try {
    const done = await addTakedown(await adminContext(), {
      ad: String(input.ad ?? ""),
      askedBy: String(input.askedBy ?? ""),
      channel: String(input.channel ?? ""),
      reason: String(input.reason ?? ""),
      receivedAt: String(input.receivedAt ?? ""),
      dueAt: String(input.dueAt ?? ""),
    });
    revalidatePath("/admin/reports/");
    return { ok: true, id: done.id };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}
