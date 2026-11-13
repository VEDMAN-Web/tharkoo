import { ForbiddenError } from "@/server/http";

export interface SpendRequest {
  userId: string;
  vendorId: string;
  coins: number;
  /** What the coins are for, for example a tour booking. */
  purpose: string;
  refId: string;
}

export type SpendGuard = (request: SpendRequest) => Promise<string | null> | string | null;

const guards: SpendGuard[] = [];

/**
 * Hook for H6.5. A guard returns a reason to refuse a spend, or null to allow it.
 * The people-category guard registers itself here; H6.6 ships none.
 */
export function registerSpendGuard(guard: SpendGuard) {
  guards.push(guard);
  return () => {
    const index = guards.indexOf(guard);
    if (index >= 0) guards.splice(index, 1);
  };
}

export async function assertSpendAllowed(request: SpendRequest) {
  for (const guard of guards) {
    const reason = await guard(request);
    if (reason) throw new ForbiddenError(reason);
  }
}
