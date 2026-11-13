/** Shows a rupee price as "₹ 12,500", or an empty string when there is no usable price. */
export function formatPrice(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "";
  return `₹ ${Math.round(value).toLocaleString("en-IN")}`;
}
