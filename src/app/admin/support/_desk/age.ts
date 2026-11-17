export const OVER_HOURS = 4;

/** "Over 39 h" for a ticket that has waited for support more than OVER_HOURS since the customer's last message, else null. One word for the list and the ticket header. */
export function overLabel(status: string, lastCustomerMessageAt: string | Date, now: number): string | null {
  if (status !== "waiting_for_support") return null;
  const hours = (now - new Date(lastCustomerMessageAt).getTime()) / 3_600_000;
  return hours >= OVER_HOURS ? `Over ${Math.floor(hours)} h` : null;
}
