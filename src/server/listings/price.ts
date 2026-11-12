import { ValidationError } from "@/server/http";

export const PRICE_MAX = 1_000_000_000;

/**
 * Price is a first-class number in whole Indian rupees. It is not an attribute, so the attribute deny-list is untouched.
 * Returns the number, `null` to clear it, or `undefined` when the caller sent nothing.
 */
export function parsePrice(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).replace(/[,\s]/g, "").replace(/^(?:₹|rs\.?|inr)/i, ""));
  if (!Number.isFinite(number) || !Number.isInteger(number) || number < 0 || number > PRICE_MAX) {
    throw new ValidationError("Invalid request", { price: ["Price must be a whole number of rupees, 0 or more"] });
  }
  return number;
}
