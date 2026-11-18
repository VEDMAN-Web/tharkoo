import { fieldLabel } from "@/lib/admin/history-words";
import mongoose, { type Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http";
import { CreditPack } from "@/server/models";
import { PACK_TAGS } from "@/server/billing/pack-tags";

/**
 * H8.20 (A20): recharge packs of Prices & plans. Every change goes through adminWrite (admin permission, audit) and a change of an
 * existing pack can be undone for the "settings" window (30 days); the undo restores only from the saved values.
 * A hidden pack disappears from what people can buy (`rechargePacks()` lists active packs only).
 */

const MAX_CREDITS = 1_000_000;
const MAX_PRICE = 10_000_000;

export type PackRow = {
  id: string;
  credits: number;
  bonus: number;
  total: number;
  /** Price in rupees. */
  price: number;
  /** Rupees for one credit, bonus included, two decimals. */
  perCredit: number;
  tag: string;
  shown: boolean;
};

export type PackWrite = { eventId: string; undoUntil: string | null; summary: string };

type PackDoc = { _id: Types.ObjectId; credits?: number; bonus?: number; price?: number; tag?: string; status?: string };

/** Rupees per credit including the free credits. 0 when the pack has no credits. */
export function pricePerCredit(price: number, credits: number, bonus: number): number {
  const total = credits + bonus;
  return total > 0 ? Math.round((price / total) * 100) / 100 : 0;
}

function rowOf(doc: PackDoc): PackRow {
  const credits = doc.credits ?? 0;
  const bonus = doc.bonus ?? 0;
  const price = Math.round(doc.price ?? 0);
  return { id: String(doc._id), credits, bonus, total: credits + bonus, price, perCredit: pricePerCredit(price, credits, bonus), tag: doc.tag ?? "", shown: doc.status !== "hidden" };
}

/** Packs smallest first, the way people see them. */
export async function readPacks(): Promise<PackRow[]> {
  await connectDb();
  const docs = await CreditPack.find({}).lean<PackDoc[]>();
  return docs.map(rowOf).sort((a, b) => a.total - b.total || a.price - b.price);
}

type PackInput = { credits: unknown; bonus: unknown; price: unknown; tag: unknown; shown: unknown };

function whole(value: unknown, min: number, max: number, message: string): number {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  if (!Number.isInteger(number) || number < min || number > max) throw new ValidationError(message);
  return number;
}

function cleanPack(input: PackInput) {
  const credits = whole(input.credits, 1, MAX_CREDITS, `Credits is a whole number from 1 to ${MAX_CREDITS.toLocaleString("en-IN")}.`);
  const bonus = whole(input.bonus ?? 0, 0, MAX_CREDITS, `Free credits is a whole number from 0 to ${MAX_CREDITS.toLocaleString("en-IN")}.`);
  const price = whole(input.price, 1, MAX_PRICE, "The price is a whole number of rupees, 1 or more.");
  const tag = typeof input.tag === "string" ? input.tag : "";
  if (!(PACK_TAGS as readonly string[]).includes(tag)) throw new ValidationError("Choose a tag from the list.");
  if (typeof input.shown !== "boolean") throw new ValidationError("Choose Shown or Hidden.");
  return { credits, bonus, price, tag, status: input.shown ? "active" : "hidden" };
}

const KEYS = ["credits", "bonus", "price", "tag", "status"];

function pick(doc: Record<string, unknown> | null, keys: string[]) {
  return Object.fromEntries(keys.filter((key) => doc && key in doc).map((key) => [key, (doc as Record<string, unknown>)[key]]));
}

export async function updatePack(ctx: AdminCtx, input: { id: string } & PackInput): Promise<PackWrite> {
  await connectDb();
  if (!mongoose.isValidObjectId(input.id)) throw new NotFoundError("Not found");
  const current = await CreditPack.findById(input.id).lean<PackDoc | null>();
  if (!current) throw new NotFoundError("Not found");
  const next = cleanPack(input);
  const label = `${next.credits.toLocaleString("en-IN")} credits`;
  const written = await adminWrite(ctx, {
    perm: "prices.edit",
    action: "pack.update",
    target: { type: "credit_pack", id: String(current._id), label },
    undo: { kind: "record.restore", windowKey: "settings" },
    before: async () => pick(current as unknown as Record<string, unknown>, KEYS),
    apply: async () => {
      const was = (await CreditPack.findById(input.id).lean()) as Record<string, unknown> | null;
      const doc = (await CreditPack.findByIdAndUpdate(input.id, { $set: next }, { returnDocument: "after" }).lean()) as Record<string, unknown> | null;
      const changed = KEYS.filter((key) => JSON.stringify(was?.[key]) !== JSON.stringify(doc?.[key]));
      return {
        after: pick(doc, KEYS),
        result: null,
        summary: changed.length ? `Changed the ${label} pack: ${changed.map(fieldLabel).join(", ")}` : `The ${label} pack saved, nothing changed`,
        undoData: { model: "CreditPack", id: String(current._id), restore: pick(was, KEYS), unset: KEYS.filter((key) => !was || !(key in was)), expect: pick(doc, KEYS) },
      };
    },
  });
  await refreshPublicCache("recharge packs");
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `Saved the ${label} pack` };
}

/** Adds a pack. The same credits and price twice is refused, so a double click cannot add two. */
export async function createPack(ctx: AdminCtx, input: PackInput): Promise<PackWrite> {
  await connectDb();
  const next = cleanPack(input);
  if (await CreditPack.exists({ credits: next.credits, bonus: next.bonus, price: next.price })) throw new ConflictError("A pack with these credits and this price already exists.");
  const label = `${next.credits.toLocaleString("en-IN")} credits`;
  const written = await adminWrite(ctx, {
    perm: "prices.edit",
    action: "pack.create",
    target: { type: "credit_pack", id: `${next.credits}-${next.bonus}-${next.price}`, label },
    before: async () => null,
    apply: async () => {
      const doc = await CreditPack.create({ ...next, order: next.credits + next.bonus });
      return { after: next, result: String(doc._id), summary: `Added the ${label} pack` };
    },
  });
  await refreshPublicCache("recharge packs");
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: `Added the ${label} pack` };
}
