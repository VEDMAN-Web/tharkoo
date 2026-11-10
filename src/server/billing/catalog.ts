import { ValidationError } from "@/server/http";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** PRD default: six Star listings per city. The order model has no slot field. */
export const STAR_SLOT_CAP = 6;
export const TOP_BOOSTS_PER_DAY = 3;
const TOP_DAYS = [1, 3, 7] as const;

export interface PromotionRule {
  durationDays: number;
  durationMs: number;
  boosts: number;
  intervalMs: number;
  boostWindowMs: number | null;
}

function topDays(requested: number | undefined, productDays: number) {
  if (requested !== undefined && !TOP_DAYS.includes(requested as (typeof TOP_DAYS)[number])) {
    throw new ValidationError("Invalid request", {
      durationDays: ["Top duration must be 1, 3, or 7 days"],
    });
  }
  if (requested !== undefined) return requested;
  if (TOP_DAYS.includes(productDays as (typeof TOP_DAYS)[number])) return productDays;
  return 7;
}

export function promotionRule(
  code: string,
  requestedDays: number | undefined,
  productDays: number,
): PromotionRule {
  const normalized = code.trim().toLowerCase();
  if (normalized === "flash") {
    const boosts = 5;
    return {
      durationDays: productDays > 0 ? productDays : 1,
      durationMs: 4 * HOUR,
      boosts,
      intervalMs: HOUR / boosts,
      boostWindowMs: HOUR,
    };
  }
  if (normalized === "auto-boost") {
    const boosts = 10;
    const durationMs = 6 * HOUR;
    return {
      durationDays: productDays > 0 ? productDays : 1,
      durationMs,
      boosts,
      intervalMs: durationMs / boosts,
      boostWindowMs: durationMs,
    };
  }
  if (normalized === "top") {
    const days = topDays(requestedDays, productDays);
    const durationMs = days * DAY;
    return {
      durationDays: days,
      durationMs,
      boosts: TOP_BOOSTS_PER_DAY * days,
      intervalMs: DAY / TOP_BOOSTS_PER_DAY,
      boostWindowMs: null,
    };
  }
  const days = requestedDays && requestedDays > 0 ? requestedDays : productDays > 0 ? productDays : 7;
  return {
    durationDays: days,
    durationMs: days * DAY,
    boosts: 0,
    intervalMs: 0,
    boostWindowMs: null,
  };
}

export function boostsDue(code: string, durationDays: number, startsAt: Date, now: Date) {
  const rule = promotionRule(code, durationDays, durationDays);
  if (rule.boosts <= 0 || rule.intervalMs <= 0) return 0;
  const elapsed = now.getTime() - startsAt.getTime();
  if (elapsed < 0) return 0;
  const window = rule.boostWindowMs ?? rule.durationMs;
  if (elapsed >= window) return rule.boosts;
  return Math.min(rule.boosts, Math.floor(elapsed / rule.intervalMs) + 1);
}
