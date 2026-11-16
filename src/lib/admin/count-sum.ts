import type { CountId } from "@/lib/admin/screens";

export type AdminCounts = Partial<Record<CountId, number>>;

export function sumCounts(counts: AdminCounts, ids: readonly CountId[]): number | null {
  const present = ids.filter((id) => typeof counts[id] === "number");
  if (present.length === 0) return null;
  return present.reduce((total, id) => total + (counts[id] ?? 0), 0);
}

export function allWaiting(counts: AdminCounts): number {
  return Object.values(counts).reduce<number>((total, value) => total + (typeof value === "number" ? value : 0), 0);
}

export function countLabel(value: number): string {
  return value > 99 ? "99+" : String(value);
}
