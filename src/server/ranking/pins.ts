import { Schema, type Types } from "mongoose";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";

/** A pinned ad. `scope` is "home", "hub:<category>", "hub:<category>/<city>" or "hub:<category>/<city>/<district>". */
export interface ListingPinDoc {
  _id?: Types.ObjectId;
  scope: string;
  listingId: string;
  position: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdBy: string;
  createdAt?: Date;
}

const listingPinSchema = new Schema<ListingPinDoc>(
  {
    scope: { type: String, required: true, index: true },
    listingId: { type: String, required: true },
    position: { type: Number, required: true, min: 1 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: collectionName("listingpins", "ListingPin") },
);

export const ListingPin = registerModel<ListingPinDoc>(modelName("ListingPin"), listingPinSchema);

export type PinWindow = Pick<ListingPinDoc, "listingId" | "position" | "startsAt" | "endsAt">;

export function isPinActive(pin: Pick<PinWindow, "startsAt" | "endsAt">, now: Date) {
  const nowMs = now.getTime();
  if (pin.startsAt && new Date(pin.startsAt).getTime() > nowMs) return false;
  if (pin.endsAt && new Date(pin.endsAt).getTime() <= nowMs) return false;
  return true;
}

/**
 * Moves pinned rows to their 1-based position in an already sorted list.
 * A pin is used only when it is inside its date window and its ad is in `ordered`
 * (so it is active and matches the feed's filter). Returns a new array.
 */
export function applyPins<T>(ordered: readonly T[], pins: readonly PinWindow[], idOf: (row: T) => string, now: Date): T[] {
  const present = new Map(ordered.map((row) => [idOf(row), row]));
  const usable: PinWindow[] = [];
  const taken = new Set<string>();
  for (const pin of [...pins].sort((a, b) => a.position - b.position || a.listingId.localeCompare(b.listingId))) {
    if (taken.has(pin.listingId) || !present.has(pin.listingId) || !isPinActive(pin, now)) continue;
    taken.add(pin.listingId);
    usable.push(pin);
  }
  if (usable.length === 0) return [...ordered];
  const result = ordered.filter((row) => !taken.has(idOf(row)));
  for (const pin of usable) {
    const row = present.get(pin.listingId) as T;
    result.splice(Math.min(Math.max(pin.position, 1) - 1, result.length), 0, row);
  }
  return result;
}

interface ScopeInput {
  categorySlug?: string;
  citySlug?: string;
  districtSlug?: string;
  stateSlug?: string;
  areaSlug?: string;
  placeSlug?: string;
  q?: string;
  slug?: string;
  excludeSlug?: string;
  starOnly?: boolean;
}

/** The pin scope a feed query belongs to, or null when pins do not apply (search, related ads, single ad). */
export function pinScopeOf(input: ScopeInput): string | null {
  if (input.q || input.slug || input.excludeSlug || input.starOnly) return null;
  if (input.stateSlug || input.areaSlug || input.placeSlug) return null;
  const parts = [input.categorySlug, input.citySlug, input.districtSlug];
  if (!parts.some(Boolean)) return "home";
  const chosen: string[] = [];
  for (const part of parts) {
    if (!part) break;
    chosen.push(part.trim().toLowerCase());
  }
  return chosen.length === parts.filter(Boolean).length ? `hub:${chosen.join("/")}` : null;
}

export async function loadActivePins(scope: string, now: Date): Promise<PinWindow[]> {
  const pins = await ListingPin.find({ scope }).lean();
  return pins.filter((pin) => isPinActive(pin, now));
}
