"use server";

import { revalidatePath } from "next/cache";
import { adminContext, type AdminCtx } from "@/server/admin/context";
import { giveCreditsBack, markRechargeFailed, markRechargePaid, type OrderActionResult } from "@/server/admin/order-actions";
import { HttpError } from "@/server/http";

/** H8.24: server actions behind "What to do" in the Orders & credits drawer. They answer { ok } and never throw a stack to the browser. */

export type MoneyActionResult = ({ ok: true } & OrderActionResult) | { ok: false; message: string };

async function run(work: (ctx: AdminCtx) => Promise<OrderActionResult>): Promise<MoneyActionResult> {
  try {
    const done = await work(await adminContext());
    revalidatePath("/admin/finance/");
    return { ok: true, ...done };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function markPaidAction(input: { paymentId: string; reason: string }): Promise<MoneyActionResult> {
  return run((ctx) => markRechargePaid(ctx, { paymentId: String(input.paymentId), reason: input.reason }));
}

export async function markFailedAction(input: { paymentId: string; reason: string }): Promise<MoneyActionResult> {
  return run((ctx) => markRechargeFailed(ctx, { paymentId: String(input.paymentId), reason: input.reason }));
}

export async function giveBackAction(input: { paymentId: string; amount: number; reason: string }): Promise<MoneyActionResult> {
  return run((ctx) => giveCreditsBack(ctx, { paymentId: String(input.paymentId), amount: input.amount, reason: input.reason }));
}
