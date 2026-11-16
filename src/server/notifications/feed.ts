import { connectDb } from "@/lib/db";
import { listEntries } from "@/server/billing";
import { unreadCount } from "@/server/chat/service";
import { SupportTicket } from "@/server/models/support";

/**
 * H7.6: the Notifications page. There is no separate notification store yet, so every item is a real
 * event read from its own source: support replies, unread chat messages and coin entries.
 * Nothing is invented: when a source is empty it simply adds no items.
 */

export type NotificationKind = "support" | "chat" | "coins";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  at: string | null;
};

const LIMIT = 30;

/** Pure: newest first. Items without a time go last. Keeps the first LIMIT items. */
export function mergeNotifications(items: readonly NotificationItem[], limit = LIMIT): NotificationItem[] {
  const time = (item: NotificationItem) => (item.at ? new Date(item.at).getTime() : Number.NEGATIVE_INFINITY);
  return items
    .slice()
    .sort((a, b) => time(b) - time(a))
    .slice(0, limit);
}

/** Pure: the coin line for one wallet entry. Zero entries are skipped by the caller. */
export function coinLine(delta: number, reason: string, refType?: string): { title: string; body: string } {
  const amount = Math.abs(delta);
  const unit = amount === 1 ? "credit" : "credits";
  if (delta > 0 && refType === "listing_fee_refund") return { title: `${amount} ${unit} returned`, body: "Your ad was not approved, so the posting fee was returned to your wallet." };
  if (delta < 0 && refType === "listing_fee") return { title: `${amount} ${unit} used`, body: "Posting fee for your ad." };
  if (delta > 0) return { title: `${amount} ${unit} added`, body: reason || "Credits were added to your wallet." };
  return { title: `${amount} ${unit} used`, body: reason || "Credits were used." };
}

export async function loadNotifications(userId: string): Promise<NotificationItem[]> {
  await connectDb();
  const [tickets, unread, entries] = await Promise.all([
    SupportTicket.find({ ownerId: userId, unreadForOwner: true })
      .sort({ lastMessageAt: -1 })
      .limit(LIMIT)
      .select("number subject lastMessageAt")
      .lean<{ _id: { toString(): string }; number: number; subject?: string; lastMessageAt?: Date }[]>(),
    unreadCount(userId),
    listEntries(userId, 1, 10),
  ]);
  const support: NotificationItem[] = tickets.map((ticket) => ({
    id: `support-${ticket._id.toString()}`,
    kind: "support",
    title: `New reply on ticket #${ticket.number}`,
    body: ticket.subject || "Tharkoo support replied to your ticket.",
    href: `/u/account/support/${ticket._id.toString()}/`,
    at: ticket.lastMessageAt ? new Date(ticket.lastMessageAt).toISOString() : null,
  }));
  const chat: NotificationItem[] =
    unread > 0
      ? [
          {
            id: "chat-unread",
            kind: "chat",
            title: unread === 1 ? "1 unread chat message" : `${unread} unread chat messages`,
            body: "Open Chats to read and reply.",
            href: "/u/account/messages/",
            at: null,
          },
        ]
      : [];
  const coins: NotificationItem[] = entries.items
    .filter((entry) => entry.delta !== 0)
    .map((entry) => ({
      id: `coins-${entry.id}`,
      kind: "coins" as const,
      ...coinLine(entry.delta, entry.reason, entry.refType),
      href: "/u/account/credits/history/",
      at: entry.createdAt ? new Date(entry.createdAt).toISOString() : null,
    }));
  return mergeNotifications([...support, ...chat, ...coins]);
}
