"use server";

import { revalidatePath } from "next/cache";
import { adminContext, type AdminCtx } from "@/server/admin/context";
import { saveMoneyValues, type MoneySettings } from "@/server/billing/money-settings";
import { createPlan, movePlan, updatePlan, type PlanWrite } from "@/server/billing/plans-admin";
import { HttpError } from "@/server/http";

/** H8.17: the server actions behind Prices & plans. Each answers { ok } and never throws a stack to the browser. */

export type PriceResult<T = unknown> = ({ ok: true; eventId: string; undoUntil: string | null; summary: string } & T) | { ok: false; message: string };

async function run<T>(work: (ctx: AdminCtx) => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
  try {
    const value = await work(await adminContext());
    revalidatePath("/admin/prices/");
    return { ok: true, value };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}

function plan(result: Awaited<ReturnType<typeof run<PlanWrite>>>): PriceResult {
  return result.ok ? { ok: true, ...result.value } : result;
}

export async function saveMoneyAction(values: Partial<MoneySettings>, summary: string): Promise<PriceResult<{ settings: MoneySettings }>> {
  const result = await run((ctx) => saveMoneyValues(ctx, values));
  if (!result.ok) return result;
  return { ok: true, eventId: result.value.eventId, undoUntil: result.value.undoUntil, summary, settings: result.value.settings };
}

export async function savePlanAction(input: { id: string; name: string; description: string; amount: number; durationHours: number; shown: boolean }): Promise<PriceResult> {
  return plan(await run((ctx) => updatePlan(ctx, { id: String(input.id), name: input.name, description: input.description, amount: input.amount, durationHours: input.durationHours, shown: input.shown })));
}

export async function createPlanAction(input: { code: string; name: string; description: string; amount: number; durationHours: number; shown: boolean }): Promise<PriceResult> {
  return plan(await run((ctx) => createPlan(ctx, { code: String(input.code), name: input.name, description: input.description, amount: input.amount, durationHours: input.durationHours, shown: input.shown })));
}

export async function movePlanAction(input: { id: string; direction: "up" | "down" }): Promise<PriceResult> {
  return plan(await run((ctx) => movePlan(ctx, { id: String(input.id), direction: input.direction })));
}
