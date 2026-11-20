"use client";

import { useAccount } from "@/components/account/AccountContext";

/**
 * The count beside a menu item of the account panel. It starts with the number the server rendered, then follows the live
 * counts (chat messages and support replies, the same ones the header uses): reading a chat or a ticket makes it drop at
 * once, a new message makes it appear, with no page change. Zero shows nothing.
 */
export function NavBadge({ kind, initial }: { kind: "chats" | "support" | "notifications"; initial: number }) {
  const { unread, unreadSupport, unreadReady } = useAccount();
  const live = kind === "chats" ? unread : kind === "support" ? unreadSupport : unread + unreadSupport;
  const count = unreadReady ? live : initial;
  if (count <= 0) return null;
  return (
    <span className="up-nav-badge" data-tk={`nav-badge-${kind}`} aria-label={`${count} new`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
