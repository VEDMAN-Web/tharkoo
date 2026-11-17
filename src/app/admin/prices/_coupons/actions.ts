"use server";

import { revalidatePath } from "next/cache";
import { adminContext } from "@/server/admin/context";
import { createCoupon, updateCoupon } from "@/server/billing/coupons-admin";
import { HttpError } from "@/server/http";
import type { PriceResult } from "../_actions/actions";

/** H8.20: server actions for coupons. They answer { ok } and never throw a stack to the browser. */

type CouponForm = { kind: string; amount: number; startsAt: string; endsAt: string; maxRedemptions: string; perUserLimit: string; on: boolean };

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

export async function saveCouponAction(input: CouponForm & { id: string }): Promise<PriceResult> {
  return run(async () => updateCoupon(await adminContext(), { id: String(input.id), kind: input.kind, amount: input.amount, startsAt: input.startsAt, endsAt: input.endsAt, maxRedemptions: input.maxRedemptions, perUserLimit: input.perUserLimit, on: input.on }));
}

export async function createCouponAction(input: CouponForm & { code: string }): Promise<PriceResult> {
  return run(async () => createCoupon(await adminContext(), { code: input.code, kind: input.kind, amount: input.amount, startsAt: input.startsAt, endsAt: input.endsAt, maxRedemptions: input.maxRedemptions, perUserLimit: input.perUserLimit, on: input.on }));
}
