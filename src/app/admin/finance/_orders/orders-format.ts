import type { OrderKpis } from "@/server/admin/orders";

/** Pure helpers for Orders & credits (H8.22), tested without a browser. */

const rupees = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

export function rangeLabel(range: string): string {
  return range === "7" ? "Last 7 days" : range === "30" ? "Last 30 days" : "All time";
}

export function statusLabel(status: string): string {
  return status === "pending" ? "Waiting" : status === "paid" ? "Paid" : status === "failed" ? "Failed" : status;
}

/** "4 h", "41 min", "2 days": how long something has waited. */
export function waitText(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h`;
  const days = Math.floor(minutes / (24 * 60));
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** The words on the four number cards. Test orders are counted apart and say so. */
export function kpiTexts(kpis: OrderKpis) {
  const orders = (count: number) => `${count.toLocaleString("en-IN")} ${count === 1 ? "order" : "orders"}`;
  return {
    sales: { value: rupees(kpis.realSales.rupees), hint: orders(kpis.realSales.orders) },
    test: { value: kpis.testOrders.count.toLocaleString("en-IN"), hint: `${rupees(kpis.testOrders.rupees)}, left out of sales` },
    check: { value: kpis.toCheck.count.toLocaleString("en-IN"), hint: kpis.toCheck.oldestMinutes === null ? "Nothing waiting" : `Oldest ${waitText(kpis.toCheck.oldestMinutes)}` },
    payouts: { value: kpis.payouts.count.toLocaleString("en-IN"), hint: kpis.payouts.count === 0 ? "Nothing waiting" : `${rupees(kpis.payouts.rupees)} asked for` },
  };
}
