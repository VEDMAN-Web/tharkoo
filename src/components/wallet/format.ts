/** Rupees with Indian digit grouping. Amounts are whole rupees from the server, shown with two decimals. */
export function inr(value: number) {
  return `Rs ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function dateTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function date(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  approved: "Approved",
  paid: "Paid",
  failed: "Failed",
  rejected: "Rejected",
  pending: "Pending",
  succeeded: "Paid for",
  refunded: "Refunded",
  refund_blocked: "Refund held",
};

/** Colours come from the theme tokens so the status pill works in light and dark. */
export function statusTone(status: string): { color: string; background: string } {
  if (status === "paid" || status === "succeeded") return { color: "var(--ok, #1f7a3a)", background: "var(--ok-bg, #e7f5ea)" };
  if (status === "failed" || status === "rejected" || status === "refunded" || status === "refund_blocked") {
    return { color: "var(--danger, #a12626)", background: "var(--danger-bg, #fbe9e9)" };
  }
  return { color: "var(--accent)", background: "var(--gold-soft, #f3d98b)" };
}
