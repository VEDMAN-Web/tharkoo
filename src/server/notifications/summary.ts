import { userFromToken } from "@/server/auth/service";
import { walletBalance } from "@/server/billing";
import { unreadCount } from "@/server/chat/service";
import { getCategories, getCities, getCreditPacks } from "@/lib/queries";
import { unreadForOwner } from "@/server/support/tickets";

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
    };

export async function loadPanelSummary(token: string | undefined): Promise<PanelSummary> {
  const session = await userFromToken(token).catch(() => null);
  if (!session) return { signedIn: false };
  const userId = session.user.id;
  const [balance, unreadChat, unreadSupport] = await Promise.all([
    walletBalance(userId),
    unreadCount(userId),
    unreadForOwner(userId),
  ]);
  const email = session.user.email ?? "";
  return {
    signedIn: true,
    userId,
    email,
    displayName: session.user.displayName || email.split("@")[0] || "there",
    balance,
    unreadChat,
    unreadSupport,
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
