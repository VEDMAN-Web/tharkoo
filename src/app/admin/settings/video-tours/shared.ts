import { VIDEO_NEVER_FOR_PEOPLE } from "@/lib/category-kinds";
import { TOUR_MIN_PRICE_COINS } from "@/server/tours/split";

/** H19.8: the rules the Video tours page and the category form share, so both show and change the same value in the same way. */
export const COIN_MIN = TOUR_MIN_PRICE_COINS;
export const COIN_MAX = 100;
export const LOCK_PEOPLE = VIDEO_NEVER_FOR_PEOPLE;
export const LOCK_KIND = "This kind does not allow live video tours. Change it under Categories & fields, Kinds.";
export const LOCK_NO_KIND = "Set the category kind first";

export function isCoinPrice(value: string) {
  const number = Number(value);
  return /^\d+$/.test(value.trim()) && number >= COIN_MIN && number <= COIN_MAX;
}

/** The line under the price: the vendor keeps the rest of what Tharkoo keeps (the share is the H19.10 money setting). */
export function shareLine(sharePercent: number) {
  return `Users pay this per call. The vendor keeps ${100 - sharePercent} %, Tharkoo keeps ${sharePercent} %.`;
}

/** Why the switch is locked off, or an empty text when it is free. */
export function lockOf(input: { kind: string | null; peopleLocked?: boolean; kindVideoOff?: boolean }) {
  if (input.kind === "people" || input.peopleLocked) return LOCK_PEOPLE;
  if (!input.kind) return LOCK_NO_KIND;
  if (input.kindVideoOff) return LOCK_KIND;
  return "";
}
