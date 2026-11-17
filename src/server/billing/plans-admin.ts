import mongoose, { type Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { orderPlans, promotionRule } from "@/server/billing/catalog";
import { SITE_KEY, readMoneySettings, readPlanOrder, type MoneySettings } from "@/server/billing/money-settings";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http";
import { Payment, PromotionProduct, Site } from "@/server/models";
import { ALLOWED_PRODUCT_CODES, productCodeDenied } from "@/server/shared/policy";

/**
 * H8.17 (A17): the promotion plans of Prices & plans. Every change goes through adminWrite (admin permission, blocked words,
 * audit) and can be undone for the "settings" window (30 days) by the record.restore handler, which restores only from the saved values.
 */

export const MAX_PLAN_PRICE = 100_000;
const NAME_MAX = 40;
const DESCRIPTION_MAX = 120;
const MAX_DAYS = 365;
const TOP_DAYS = [1, 3, 7];
/** Plans whose length is fixed by their type, not by the number of days. */
const FIXED_LENGTH = new Set(["flash", "auto-boost"]);

export type PlanRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  /** Price in credits. */
  amount: number;
  durationDays: number;
  /** "4 hours", "7 days": what the buyer gets, from the plan type's rule. */
  lasts: string;
  fixedLength: boolean;
  shown: boolean;
  /** False for a plan type that is no longer allowed on Tharkoo: it is never offered. */
  allowed: boolean;
};

export type PricesData = {
  money: MoneySettings;
  plans: PlanRow[];
  /** Plan types that can still be added. */
  freeCodes: string[];
  testCredits: { credits: number; wallets: number };
};

type ProductDoc = { _id: Types.ObjectId; code: string; name: string; description?: string; amount: number; durationDays: number; enabled?: boolean };

export function lastsText(code: string, durationDays: number): string {
  const rule = promotionRule(code, undefined, durationDays);
  const hours = rule.durationMs / (60 * 60 * 1000);
  if (hours < 24) return `${hours} hours`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function rowOf(doc: ProductDoc): PlanRow {
  return {
    id: String(doc._id),
    code: doc.code,
    name: doc.name,
    description: doc.description ?? "",
    amount: doc.amount,
    durationDays: doc.durationDays,
    lasts: lastsText(doc.code, doc.durationDays),
    fixedLength: FIXED_LENGTH.has(doc.code),
    shown: doc.enabled !== false,
    allowed: !productCodeDenied(doc.code).denied,
  };
}

/** Credits added through test payments (provider "mock"), and the wallets that got them. Never real money. */
export async function testCreditsFigure(): Promise<{ credits: number; wallets: number }> {
  await connectDb();
  const rows = await Payment.find({ status: "paid", provider: "mock" }).select("credits userId").lean<{ credits?: number; userId: Types.ObjectId }[]>();
  return { credits: rows.reduce((sum, row) => sum + (row.credits ?? 0), 0), wallets: new Set(rows.map((row) => String(row.userId))).size };
}

export async function readPricesData(): Promise<PricesData> {
  await connectDb();
  const [money, docs, order, testCredits] = await Promise.all([
    readMoneySettings(),
    PromotionProduct.find({}).lean<ProductDoc[]>(),
    readPlanOrder(),
    testCreditsFigure(),
  ]);
  const plans = orderPlans(docs, order).map(rowOf);
  const used = new Set(plans.map((plan) => plan.code));
  return { money, plans, freeCodes: ALLOWED_PRODUCT_CODES.filter((code) => !used.has(code)), testCredits };
}

type PlanInput = { name: unknown; description: unknown; amount: unknown; durationDays: unknown; shown: unknown };

function cleanPlan(code: string, input: PlanInput, currentDays: number) {
  const name = typeof input.name === "string" ? input.name.replace(/\s+/g, " ").trim() : "";
  const description = typeof input.description === "string" ? input.description.replace(/\s+/g, " ").trim() : "";
  if (name.length < 1 || name.length > NAME_MAX) throw new ValidationError(`Give the plan a name of 1 to ${NAME_MAX} characters.`);
  if (description.length < 1 || description.length > DESCRIPTION_MAX) throw new ValidationError(`Write the line under the name, ${DESCRIPTION_MAX} characters at most.`);
  if (/[<>]/.test(name + description)) throw new ValidationError("Text cannot contain < or >.");
  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount < 0 || amount > MAX_PLAN_PRICE) throw new ValidationError(`The price is a whole number of credits from 0 to ${MAX_PLAN_PRICE.toLocaleString("en-IN")}.`);
  let durationDays = Number(input.durationDays);
  if (FIXED_LENGTH.has(code)) durationDays = currentDays;
  else if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > MAX_DAYS) throw new ValidationError(`Days is a whole number from 1 to ${MAX_DAYS}.`);
  if (code === "top" && !TOP_DAYS.includes(durationDays)) throw new ValidationError("TOP lasts 1, 3 or 7 days.");
  if (typeof input.shown !== "boolean") throw new ValidationError("Choose Shown or Hidden.");
  return { name, description, amount, durationDays, enabled: input.shown };
}

function pick(doc: Record<string, unknown> | null, keys: string[]) {
  return Object.fromEntries(keys.filter((key) => doc && key in doc).map((key) => [key, (doc as Record<string, unknown>)[key]]));
}

const PLAN_KEYS = ["name", "description", "amount", "durationDays", "enabled"];

export type PlanWrite = { eventId: string; undoUntil: string | null; summary: string };

/** Changes one plan. A plan type that is not allowed on Tharkoo cannot be edited into a live offer. */
export async function updatePlan(ctx: AdminCtx, input: { id: string } & PlanInput): Promise<PlanWrite> {
  await connectDb();
  if (!mongoose.isValidObjectId(input.id)) throw new NotFoundError("Not found");
  const current = await PromotionProduct.findById(input.id).lean<ProductDoc | null>();
  if (!current) throw new NotFoundError("Not found");
  if (productCodeDenied(current.code).denied) throw new ConflictError("This plan type is not allowed on Tharkoo, so it cannot be edited.");
  const next = cleanPlan(current.code, input, current.durationDays);
  const written = await adminWrite(ctx, {
    perm: "prices.edit",
    action: "plan.update",
    target: { type: "promotion_plan", id: String(current._id), label: current.name },
    texts: [next.name, next.description],
    undo: { kind: "record.restore", windowKey: "settings" },
    before: async () => pick(current as unknown as Record<string, unknown>, PLAN_KEYS),
    apply: async () => {
      const was = (await PromotionProduct.findById(input.id).lean()) as Record<string, unknown> | null;
      const doc = (await PromotionProduct.findByIdAndUpdate(input.id, { $set: next }, { returnDocument: "after" }).lean()) as Record<string, unknown> | null;
      const changed = PLAN_KEYS.filter((key) => JSON.stringify(was?.[key]) !== JSON.stringify(doc?.[key]));
      return {
        after: pick(doc, PLAN_KEYS),
        result: null,
        summary: changed.length ? `Changed ${current.name}: ${changed.join(", ")}` : `${current.name} saved, nothing changed`,
        undoData: { model: "PromotionProduct", id: String(current._id), restore: pick(was, PLAN_KEYS), unset: PLAN_KEYS.filter((key) => !was || !(key in was)), expect: pick(doc, PLAN_KEYS) },
      };
    },
  });
  await refreshPublicCache("promotion plans");
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `Saved ${next.name}` };
}

/** Adds a plan of an allowed type that does not exist yet (hidden until the admin turns it on). */
export async function createPlan(ctx: AdminCtx, input: { code: string } & PlanInput): Promise<PlanWrite> {
  await connectDb();
  const code = String(input.code ?? "").trim().toLowerCase();
  if (productCodeDenied(code).denied) throw new ValidationError("Choose one of the plan types shown.");
  if (await PromotionProduct.exists({ code })) throw new ConflictError("This plan type already exists.");
  const next = cleanPlan(code, input, 1);
  const written = await adminWrite(ctx, {
    perm: "prices.edit",
    action: "plan.create",
    target: { type: "promotion_plan", id: code },
    texts: [next.name, next.description],
    before: async () => null,
    apply: async () => {
      const doc = await PromotionProduct.create({ code, currency: "INR", ...next });
      return { after: { code, ...next }, result: String(doc._id), summary: `Added the plan ${next.name}` };
    },
  });
  await refreshPublicCache("promotion plans");
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `Added ${next.name}` };
}

/** Moves a plan one place up or down. The order is one list on the site record, so one undo restores it. */
export async function movePlan(ctx: AdminCtx, input: { id: string; direction: "up" | "down" }): Promise<PlanWrite> {
  await connectDb();
  if (!mongoose.isValidObjectId(input.id)) throw new NotFoundError("Not found");
  if (input.direction !== "up" && input.direction !== "down") throw new ValidationError("Choose up or down.");
  const docs = await PromotionProduct.find({}).lean<ProductDoc[]>();
  const codes = orderPlans(docs, await readPlanOrder()).map((doc) => doc.code);
  const target = docs.find((doc) => String(doc._id) === input.id);
  if (!target) throw new NotFoundError("Not found");
  const from = codes.indexOf(target.code);
  const to = input.direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= codes.length) throw new ConflictError(input.direction === "up" ? "This plan is already first." : "This plan is already last.");
  const next = [...codes];
  [next[from], next[to]] = [next[to], next[from]];
  const written = await adminWrite(ctx, {
    perm: "prices.edit",
    action: "plan.reorder",
    target: { type: "site", id: SITE_KEY },
    undo: { kind: "record.restore", windowKey: "settings" },
    before: async () => ({ planOrder: codes }),
    apply: async () => {
      const was = (await Site.findOne({ key: SITE_KEY }).lean()) as Record<string, unknown> | null;
      await Site.updateOne({ key: SITE_KEY }, { $set: { planOrder: next } }, { upsert: true });
      const site = (await Site.findOne({ key: SITE_KEY }).lean()) as Record<string, unknown> | null;
      return {
        after: { planOrder: next },
        result: null,
        summary: `Moved ${target.name} ${input.direction}`,
        undoData: { model: "Site", id: String(site?._id), restore: pick(was, ["planOrder"]), unset: was && "planOrder" in was ? [] : ["planOrder"], expect: pick(site, ["planOrder"]) },
      };
    },
  });
  await refreshPublicCache("promotion plans");
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `Moved ${target.name} ${input.direction}` };
}
