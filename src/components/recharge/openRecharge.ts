export const RECHARGE_EVENT = "tk-recharge-open";
export const SUPPORT_EVENT = "tk-support-open";

export type RechargeOptions = { shortfall?: number; returnTo?: string; shortKey?: "recharge.short" | "recharge.short.promote" };

export function openRecharge(options: RechargeOptions = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<RechargeOptions>(RECHARGE_EVENT, { detail: options }));
}

export function openSupportWith(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<{ message: string }>(SUPPORT_EVENT, { detail: { message } }));
}

export function rechargeLine(parts: { pack?: string; amount?: number; method?: string }): string {
  const bits: string[] = [];
  if (parts.pack) bits.push(`Pack: ${parts.pack}`);
  if (typeof parts.amount === "number") bits.push(`Amount: ₹${parts.amount.toLocaleString("en-IN")}`);
  if (parts.method) bits.push(`Method: ${parts.method}`);
  return `I need help with a credit recharge. ${bits.join(". ")}`.trim();
}
