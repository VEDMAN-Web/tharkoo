"use client";

import Link from "next/link";
import { BadgeCheck, Banknote, Flag, MessageSquare, Scale, ShieldCheck, Wallet, type LucideIcon } from "lucide-react";
import type { NotificationItem, NotificationKind } from "@/lib/admin/notification-kinds";
import { dueLabel, timeAgo } from "./format";

const ICONS: Record<NotificationKind, LucideIcon> = {
  ad: ShieldCheck,
  report: Flag,
  legal: Scale,
  idcheck: BadgeCheck,
  ticket: MessageSquare,
  payment: Wallet,
  payout: Banknote,
};

/** One line of the bell and of the Notifications page: the kind icon, one plain sentence, how long ago, and a dot while it is unread. Clicking marks it read and opens its page. */
export function NotificationRow({ item, now, onOpen }: { item: NotificationItem; now: number; onOpen: (item: NotificationItem) => void }) {
  const Icon = ICONS[item.kind];
  return (
    <li className="adm-nt-li">
      <Link href={item.href} className="adm-nt-item" data-tk="notification" data-kind={item.kind} data-unread={item.unread ? "yes" : "no"} onClick={() => onOpen(item)}>
        <span className="adm-nt-icon" aria-hidden="true">
          <Icon size={16} focusable="false" />
        </span>
        <span className="adm-nt-body">
          <span className="adm-nt-text">{item.text}</span>
          <small className="adm-nt-meta">
            {timeAgo(item.at, now)}
            {item.due ? <span className="adm-nt-due"> {`\u00B7 ${dueLabel(item.due, now)}`}</span> : null}
          </small>
        </span>
        {item.unread ? (
          <>
            <span className="adm-nt-dot" aria-hidden="true" />
            <span className="adm-nt-sr">Unread</span>
          </>
        ) : null}
      </Link>
    </li>
  );
}
