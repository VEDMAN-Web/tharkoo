"use server";

import { revalidatePath } from "next/cache";
import { adminContext } from "@/server/admin/context";
import { createPack, updatePack } from "@/server/billing/packs-admin";
import { HttpError } from "@/server/http";
import type { PriceResult } from "../_actions/actions";

/** H8.20: server actions for recharge packs. They answer { ok } and never throw a stack to the browser. */

type PackForm = { credits: number; bonus: number; price: number; tag: string; shown: boolean };

async function run(work: () => Promise<{ eventId: string; undoUntil: string | null; summary: string }>): Promise<PriceResult> {
  try {
    const done = await work();
    revalidatePath("/admin/prices/");
    return { ok: true, ...done };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function savePackAction(input: PackForm & { id: string }): Promise<PriceResult> {
  return run(async () => updatePack(await adminContext(), { id: String(input.id), credits: input.credits, bonus: input.bonus, price: input.price, tag: input.tag, shown: input.shown }));
}

export async function createPackAction(input: PackForm): Promise<PriceResult> {
  return run(async () => createPack(await adminContext(), { credits: input.credits, bonus: input.bonus, price: input.price, tag: input.tag, shown: input.shown }));
}
