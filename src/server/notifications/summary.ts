import { userFromToken } from "@/server/auth/service";
import { VideoTour } from "@/server/tours/model";
import { walletBalance } from "@/server/billing";
import { unreadCount } from "@/server/chat/service";
import { getCategories, getCities, getCreditPacks } from "@/lib/queries";
import { unreadForOwner } from "@/server/support/tickets";
import { connectDb } from "@/lib/db";
import { Listing } from "@/server/models/listing";
import { accountName } from "@/lib/account-name";
import { DELETED_STATUSES } from "@/server/listings/owner-groups";
import { userHasEarnings } from "@/server/wallet/has-earnings";

/**
 * H7.6: what the user panel shell shows: coins, unread counts and the first name for the greeting.
 * Every number is read from its source. A signed-out visitor gets `signedIn: false` and no numbers.
 */

export type PanelSummary =
  | { signedIn: false }
  | {
      signedIn: true;
      userId: string;
      email: string;
      displayName: string;
      balance: number;
      unreadChat: number;
      unreadSupport: number;
      adCount: number;
      seller: boolean;
      /** True when the account has earnings, a payout waiting or a withdrawal; the Earnings tab and Withdraw show only then (H9.1). */
      hasEarnings: boolean;
      /** H19.5: video call requests on this account's ads still waiting for an answer. */
      waitingCalls?: number;
      memberSince: string;
    };

export async function loadPanelSummary(token: string | undefined): Promise<PanelSummary> {
  await connectDb();
  const session = await userFromToken(token).catch(() => null);
  if (!session) return { signedIn: false };
  const userId = session.user.id;
  const [balance, unreadChat, unreadSupport, adCount, hasEarnings, waitingCalls] = await Promise.all([
    walletBalance(userId),
    unreadCount(userId),
    unreadForOwner(userId),
    Listing.countDocuments({ ownerId: userId, status: { $nin: [...DELETED_STATUSES] } }),
    userHasEarnings(userId),
    VideoTour.countDocuments({ ownerId: userId, status: "requested" }),
  ]);
  const email = session.user.email ?? "";
  return {
    signedIn: true,
    userId,
    email,
    displayName: accountName(session.user.displayName, email),
    balance,
    unreadChat,
    unreadSupport,
    adCount,
    seller: Boolean(session.user.seller),
    hasEarnings,
    waitingCalls,
    memberSince: new Date(parseInt(userId.slice(0, 8), 16) * 1000).toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
  };
}

export type PackRow = { id: string; credits: number; price: number; bonus?: number; tag?: string };

/** The active coin packs, in the order the admin set. Read-only on the panel. */
export async function loadPacks(): Promise<PackRow[]> {
  const packs = await getCreditPacks();
  return packs.map((pack) => ({
    id: String(pack._id),
    credits: pack.credits ?? 0,
    price: pack.price ?? 0,
    bonus: pack.bonus,
    tag: pack.tag,
  }));
}

export type Picker = { slug: string; name: string };

/** Category and city lists for the Discover filters and the alert form. */
export async function loadPickers(): Promise<{ categories: Picker[]; cities: Picker[] }> {
  const [categories, cities] = await Promise.all([getCategories(), getCities()]);
  return {
    categories: categories.map((row) => ({ slug: String(row.slug), name: String(row.name) })),
    cities: cities.map((row) => ({ slug: String(row.slug), name: String(row.name) })),
  };
}
