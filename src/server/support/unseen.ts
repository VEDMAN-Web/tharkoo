import type { Types } from "mongoose";
import { invalidateTags } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { SupportTicket } from "@/server/models/support";

/**
 * H7.163: a ticket is UNSEEN while the team still has to act on it (open or waiting for support) and no staff member has opened it
 * since the customer's newest message. Opening it in the desk sets lastStaffViewAt; a new customer message makes it unseen again.
 * The sidebar number, the Open tab number and the bell all count this, not "every open ticket".
 */
/** The cache tag of the sidebar numbers. */
export const COUNTS_TAG = "admin-counts";

export function unseenTicketFilter() {
  return {
    status: { $in: ["open", "waiting_for_support"] as ("open" | "waiting_for_support")[] },
    $or: [{ lastStaffViewAt: null }, { $expr: { $lt: ["$lastStaffViewAt", "$lastCustomerMessageAt"] } }],
  };
}

export async function countUnseenTickets(): Promise<number> {
  await connectDb();
  return SupportTicket.countDocuments(unseenTicketFilter());
}

/** Drops the cached sidebar numbers so a change shows on the next page. */
export function clearCountsCache() {
  invalidateTags([COUNTS_TAG]);
}

export async function markSeen(ticketId: Types.ObjectId, now = new Date()) {
  await connectDb();
  await SupportTicket.updateOne({ _id: ticketId }, { $set: { lastStaffViewAt: now } });
  clearCountsCache();
}
