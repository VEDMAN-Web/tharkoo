import { type Perm } from "@/lib/admin/perms";

/** H8.53: the kinds of bell item. Kept apart from the server code so the bell and the page can use them. */

export const NOTIFICATION_KINDS = ["ad", "report", "legal", "idcheck", "ticket", "payment", "payout"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const KIND_LABEL: Record<NotificationKind, string> = {
  ad: "Ads to check",
  report: "Reports",
  legal: "Legal takedowns",
  idcheck: "ID checks",
  ticket: "Support tickets",
  payment: "Payments stuck",
  payout: "Payouts asked for",
};

/** The same permissions as the queues and the sidebar numbers. */
export const KIND_PERM: Record<NotificationKind, Perm> = {
  ad: "ads.review",
  report: "reports.handle",
  legal: "reports.legal",
  idcheck: "id.decide",
  ticket: "desk.work",
  payment: "orders.view",
  payout: "payouts.decide",
};

export type NotificationItem = {
  key: string;
  kind: NotificationKind;
  text: string;
  /** ISO time the item appeared. */
  at: string;
  href: string;
  /** Legal takedowns only: ISO time the first answer is due. */
  due: string | null;
  unread: boolean;
};

export function isKind(value: string): value is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(value);
}

