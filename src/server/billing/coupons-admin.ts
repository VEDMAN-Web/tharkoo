import mongoose, { type Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http";
import { Coupon } from "@/server/models";
import { textDenied } from "@/server/shared/policy";

/**
 * H8.20 (A20): coupons of Prices & plans. Writes go through adminWrite (admin permission, audit); a change of an existing coupon can be
 * undone for 30 days and restores only from the saved values. The code is checked against the blocked words and stored in capitals.
 */

const CODE = /^[A-Z0-9][A-Z0-9-]{2,19}$/;
const MAX_CREDITS = 100_000;
const MAX_LIMIT = 10_000_000;

export type CouponRow = {
  id: string;
  code: string;
  kind: "percent" | "credits" | "label";
  /** Percent off (kind percent) or free credits (kind credits). */
  amount: number;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  perUserLimit: number | null;
  redeemed: number;
  on: boolean;
};

export type CouponWrite = { eventId: string; undoUntil: string | null; summary: string };

type CouponDocLean = {
  _id: Types.ObjectId;
  code?: string;
  kind?: "percent" | "credits" | "label";
  percent?: number | null;
  credits?: number | null;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  maxRedemptions?: number | null;
  perUserLimit?: number | null;
  redeemedCount?: number;
  status?: string;
};

function rowOf(doc: CouponDocLean): CouponRow {
  const kind = doc.kind ?? "label";
  return {
    id: String(doc._id),
    code: doc.code ?? "",
    kind,
    amount: kind === "percent" ? (doc.percent ?? 0) : kind === "credits" ? (doc.credits ?? 0) : 0,
    startsAt: doc.startsAt ? new Date(doc.startsAt).toISOString() : null,
    endsAt: doc.expiresAt ? new Date(doc.expiresAt).toISOString() : null,
    maxRedemptions: doc.maxRedemptions ?? null,
    perUserLimit: doc.perUserLimit ?? null,
    redeemed: doc.redeemedCount ?? 0,
    on: doc.status === "active",
  };
}

export async function readCoupons(): Promise<CouponRow[]> {
  await connectDb();
  const docs = await Coupon.find({}).sort({ createdAt: -1, _id: -1 }).lean<CouponDocLean[]>();
  return docs.map(rowOf);
}

type CouponInput = { code: unknown; kind: unknown; amount: unknown; startsAt: unknown; endsAt: unknown; maxRedemptions: unknown; perUserLimit: unknown; on: unknown };

function whole(value: unknown, min: number, max: number, message: string): number {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  if (!Number.isInteger(number) || number < min || number > max) throw new ValidationError(message);
  return number;
}

function optionalWhole(value: unknown, message: string): number | null {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return null;
  return whole(value, 1, MAX_LIMIT, message);
}

function optionalDate(value: unknown, message: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new ValidationError(message);
  return date;
}

/** The code as stored: capitals, 3 to 20 letters, digits or dashes, and nothing the site does not allow. */
export function cleanCode(raw: unknown): string {
  const code = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (!CODE.test(code)) throw new ValidationError("The code is 3 to 20 letters, digits or dashes, for example WELCOME10.");
  if (textDenied(code).denied || textDenied(code.replace(/-/g, " ")).denied) throw new ValidationError("This code uses a word that is not allowed on Tharkoo.");
  return code;
}

function cleanCoupon(input: CouponInput) {
  const kind = input.kind === "percent" ? "percent" : input.kind === "credits" ? "credits" : null;
  if (!kind) throw new ValidationError("Choose percent off or free credits.");
  const amount = kind === "percent" ? whole(input.amount, 1, 100, "Percent off is a whole number from 1 to 100.") : whole(input.amount, 1, MAX_CREDITS, `Free credits is a whole number from 1 to ${MAX_CREDITS.toLocaleString("en-IN")}.`);
  const startsAt = optionalDate(input.startsAt, "The start date is not a valid date.");
  const expiresAt = optionalDate(input.endsAt, "The end date is not a valid date.");
  if (startsAt && expiresAt && expiresAt.getTime() <= startsAt.getTime()) throw new ValidationError("The end must be after the start.");
  if (typeof input.on !== "boolean") throw new ValidationError("Choose On or Off.");
  return {
    kind: kind as "percent" | "credits",
    percent: kind === "percent" ? amount : null,
    credits: kind === "credits" ? amount : null,
    startsAt,
    expiresAt,
    maxRedemptions: optionalWhole(input.maxRedemptions, "The total limit is a whole number, 1 or more, or empty for no limit."),
    perUserLimit: optionalWhole(input.perUserLimit, "The limit for each person is a whole number, 1 or more, or empty for no limit."),
    status: input.on ? "active" : "off",
  };
}

const KEYS = ["kind", "percent", "credits", "startsAt", "expiresAt", "maxRedemptions", "perUserLimit", "status"];

function pick(doc: Record<string, unknown> | null, keys: string[]) {
  return JSON.parse(JSON.stringify(Object.fromEntries(keys.filter((key) => doc && key in doc).map((key) => [key, (doc as Record<string, unknown>)[key]])))) as Record<string, unknown>;
}

async function codeTaken(code: string, exceptId?: string): Promise<boolean> {
  const rows = await Coupon.find({ code: new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).select("_id").lean<{ _id: Types.ObjectId }[]>();
  return rows.some((row) => String(row._id) !== exceptId);
}

/** Changes a coupon (not its code: people may already hold it). A text-only coupon from before cannot be edited here. */
export async function updateCoupon(ctx: AdminCtx, input: { id: string } & Omit<CouponInput, "code">): Promise<CouponWrite> {
  await connectDb();
  if (!mongoose.isValidObjectId(input.id)) throw new NotFoundError("Not found");
  const current = await Coupon.findById(input.id).lean<CouponDocLean | null>();
  if (!current) throw new NotFoundError("Not found");
  if (current.kind !== "percent" && current.kind !== "credits") throw new ConflictError("This is an old text coupon. It cannot be redeemed and cannot be edited here.");
  const next = cleanCoupon({ ...input, code: current.code });
  const code = current.code ?? "";
  const written = await adminWrite(ctx, {
    perm: "prices.edit",
    action: "coupon.update",
    target: { type: "coupon", id: String(current._id), label: code },
    undo: { kind: "record.restore", windowKey: "settings" },
    before: async () => pick(current as unknown as Record<string, unknown>, KEYS),
    apply: async () => {
      const was = (await Coupon.findById(input.id).lean()) as Record<string, unknown> | null;
      const doc = (await Coupon.findByIdAndUpdate(input.id, { $set: next }, { returnDocument: "after" }).lean()) as Record<string, unknown> | null;
      const changed = KEYS.filter((key) => JSON.stringify(pick(was, [key])) !== JSON.stringify(pick(doc, [key])));
      return {
        after: pick(doc, KEYS),
        result: null,
        summary: changed.length ? `Changed coupon ${code}: ${changed.join(", ")}` : `Coupon ${code} saved, nothing changed`,
        undoData: { model: "Coupon", id: String(current._id), restore: pick(was, KEYS), unset: KEYS.filter((key) => !was || !(key in was)), expect: pick(doc, KEYS) },
      };
    },
  });
  await refreshPublicCache("coupons");
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `Saved coupon ${code}` };
}

export async function createCoupon(ctx: AdminCtx, input: CouponInput): Promise<CouponWrite> {
  await connectDb();
  const code = cleanCode(input.code);
  const next = cleanCoupon(input);
  if (await codeTaken(code)) throw new ConflictError("This code already exists.");
  const written = await adminWrite(ctx, {
    perm: "prices.edit",
    action: "coupon.create",
    target: { type: "coupon", id: code, label: code },
    texts: [code],
    before: async () => null,
    apply: async () => {
      const doc = await Coupon.create({ code, label: code, ...next });
      return { after: { code, ...pick(next as unknown as Record<string, unknown>, KEYS) }, result: String(doc._id), summary: `Added coupon ${code}` };
    },
  });
  await refreshPublicCache("coupons");
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `Added coupon ${code}` };
}
