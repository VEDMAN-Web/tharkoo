import mongoose, { type Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import { walletBalance } from "@/server/billing/ledger";
import { RECHARGE_METHODS, statusOf } from "@/server/billing/recharge";
import { Listing, Payment, User } from "@/server/models";
import { SupportTicket } from "@/server/models/support";
import type { QueueItem } from "@/server/support/desk";

/** H8.43 (A43): the extra data the three-pane support desk needs: tab counts, the user card, the order a payment ticket is about. */

export type DeskTab = "open" | "waiting" | "closed";
export const DESK_TABS: readonly DeskTab[] = ["open", "waiting", "closed"];

export function parseTab(value: unknown): DeskTab {
  return value === "waiting" || value === "closed" ? value : "open";
}

/** The ticket queue status each tab asks for. "Open" is everything not closed and not waiting for the customer. */
export function tabStatus(tab: DeskTab): "active" | "waiting_for_user" | "closed" {
  return tab === "waiting" ? "waiting_for_user" : tab === "closed" ? "closed" : "active";
}

/** Open tab: tickets the team still has to act on (new, or waiting for support). Customers we already answered sit under "Waiting on user". */
export function inOpenTab(item: Pick<QueueItem, "status">): boolean {
  return item.status === "open" || item.status === "waiting_for_support";
}

/** Plain search over the tickets already on the page: number, subject, name. The queue itself stays server-paged. */
export function matchesSearch(item: Pick<QueueItem, "number" | "subject" | "ownerName">, q: string): boolean {
  const text = q.trim().toLowerCase().replace(/^#/, "");
  if (!text) return true;
  return String(item.number) === text || item.subject.toLowerCase().includes(text) || item.ownerName.toLowerCase().includes(text);
}

export async function tabCounts(): Promise<Record<DeskTab, number>> {
  await connectDb();
  const [open, waiting, closed] = await Promise.all([
    SupportTicket.countDocuments({ status: { $in: ["open", "waiting_for_support"] } }),
    SupportTicket.countDocuments({ status: "waiting_for_user" }),
    SupportTicket.countDocuments({ status: "closed" }),
  ]);
  return { open, waiting, closed };
}

export type UserCard = {
  userId: string;
  name: string;
  email: string;
  city: string | null;
  memberSince: string | null;
  credits: number;
  ordersWaiting: number;
  ordersPaid: number;
  adsLive: number;
  ticketsOpen: number;
  canAdjust: boolean;
  canOpenOrders: boolean;
};

export type TicketOrder = { id: string; no: string; text: string; receipt: string | null };

const receiptNo = (id: string) => `TK-${id.slice(-8).toUpperCase()}`;

export async function ownerIdOf(ticketId: string): Promise<{ ownerId: string | null; kind: string } | null> {
  await connectDb();
  if (!mongoose.isValidObjectId(ticketId)) return null;
  const row = await SupportTicket.findById(ticketId).select("ownerId ownerKind").lean<{ ownerId?: Types.ObjectId | null; ownerKind: string } | null>();
  return row ? { ownerId: row.ownerId ? String(row.ownerId) : null, kind: row.ownerKind } : null;
}

/** The numbers of the customer card. Null for a guest ticket (no account). */
export async function userCard(ownerId: string | null, roles: readonly string[]): Promise<UserCard | null> {
  await connectDb();
  if (!ownerId || !mongoose.isValidObjectId(ownerId)) return null;
  const user = await User.findById(ownerId).select("displayName email createdAt sellerProfile").lean<{ displayName?: string; email?: string; createdAt?: Date; sellerProfile?: { city?: string } } | null>();
  if (!user) return null;
  const id = new mongoose.Types.ObjectId(ownerId);
  const [credits, waiting, paid, ads, tickets] = await Promise.all([
    walletBalance(ownerId),
    Payment.countDocuments({ userId: id, status: "pending", method: { $in: [...RECHARGE_METHODS] } }),
    Payment.countDocuments({ userId: id, status: "paid", method: { $in: [...RECHARGE_METHODS] } }),
    Listing.countDocuments({ ownerId: id, status: "active" }),
    SupportTicket.countDocuments({ ownerId: id, status: { $ne: "closed" } }),
  ]);
  return {
    userId: ownerId,
    name: user.displayName || "Member",
    email: user.email ?? "",
    city: user.sellerProfile?.city ?? null,
    memberSince: user.createdAt ? user.createdAt.toISOString() : null,
    credits,
    ordersWaiting: waiting,
    ordersPaid: paid,
    adsLive: ads,
    ticketsOpen: tickets,
    canAdjust: can(roles, "wallet.adjust") || can(roles, "wallet.adjust.own"),
    canOpenOrders: can(roles, "orders.view"),
  };
}

/** The customer's newest recharge, shown inside a payment ticket so the agent sees what they are talking about. Null when there is none. */
export async function latestOrder(ownerId: string | null, roles: readonly string[]): Promise<TicketOrder | null> {
  await connectDb();
  if (!ownerId || !mongoose.isValidObjectId(ownerId)) return null;
  const row = await Payment.findOne({ userId: ownerId, method: { $in: [...RECHARGE_METHODS] } })
    .sort({ createdAt: -1 })
    .lean<{ _id: Types.ObjectId; amount: number; method?: string; coin?: string; status: "pending" | "paid" | "failed"; provider?: string; expiresAt?: Date; outcome?: string } | null>();
  if (!row) return null;
  const status = statusOf(row as never);
  const words = status === "paid" ? "paid" : status === "pending" ? "waiting for the network" : status === "cancelled" ? "cancelled" : status === "expired" ? "expired" : "failed";
  const method = row.method === "crypto" ? `Crypto${row.coin ? ` ${row.coin}` : ""}` : "Card";
  const id = String(row._id);
  return { id, no: receiptNo(id), text: `Order ${receiptNo(id)} · ${method} · ₹${Math.round(row.amount).toLocaleString("en-IN")} · ${words}${row.provider === "mock" ? " (test payment)" : ""}`, receipt: can(roles, "orders.view") ? `/admin/finance/receipt/${id}/` : null };
}
