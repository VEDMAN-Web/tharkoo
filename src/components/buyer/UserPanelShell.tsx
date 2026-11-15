import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, Heart, House, LifeBuoy, Megaphone, MessageSquare, Search, Settings, Wallet } from "lucide-react";
import type { PanelSummary } from "@/server/notifications/summary";
import "./user-panel.css";

/** H7.6, H7.17: the panel frame for every /u/account page: left menu (the mockup's "My account") and the page body. */

export type PanelKey = "home" | "saved" | "chats" | "coins" | "notifications" | "alerts" | "support" | "settings";

const LINKS: { key: PanelKey; label: string; href: string; icon: typeof House }[] = [
  { key: "home", label: "Home", href: "/u/account/dashboard/", icon: House },
  { key: "saved", label: "Saved ads", href: "/u/account/saved/", icon: Heart },
  { key: "chats", label: "Chats", href: "/u/account/messages/", icon: MessageSquare },
  { key: "coins", label: "Coins and payments", href: "/u/account/credits/", icon: Wallet },
  { key: "notifications", label: "Notifications", href: "/u/account/notifications/", icon: Bell },
  { key: "alerts", label: "Saved search alerts", href: "/u/account/alerts/", icon: Search },
  { key: "support", label: "Help and support", href: "/u/account/support/", icon: LifeBuoy },
  { key: "settings", label: "Settings", href: "/u/account/edit-account/", icon: Settings },
];

const ADS_LINKS: { key: "ads"; label: string; href: string; icon: typeof House }[] = [
  { key: "ads", label: "My ads", href: "/u/account/ads/", icon: Megaphone },
];

function renderLink(item: { key: string; label: string; href: string; icon: typeof House }, count: number, active: PanelKey) {
  const Icon = item.icon;
  const on = item.key === active;
  return (
    <li key={item.key}>
      <Link href={item.href} className={on ? "up-nav-link up-nav-link-on" : "up-nav-link"} aria-current={on ? "page" : undefined}>
        <Icon size={18} aria-hidden="true" focusable="false" />
        {item.label}
        {count > 0 ? <span className="up-nav-badge">{count}</span> : null}
      </Link>
    </li>
  );
}

/** Pure: the count shown beside a menu item. Zero shows nothing. */
export function badgeFor(key: PanelKey, summary: PanelSummary): number {
  if (!summary.signedIn) return 0;
  if (key === "chats") return summary.unreadChat;
  if (key === "support") return summary.unreadSupport;
  if (key === "notifications") return summary.unreadChat + summary.unreadSupport;
  return 0;
}

export function UserPanelShell({ active, summary, aside, below, children }: { active: PanelKey; summary: PanelSummary; aside?: ReactNode; below?: ReactNode; children: ReactNode }) {
  return (
    <div className="up-wrap">
      <div className="up-page">
        <div className={aside ? "up-layout up-layout-home" : "up-layout"}>
          <nav aria-label="My account" className="up-glass up-nav">
            <div className="up-nav-head">
              <div className="up-avatar" aria-hidden="true">
                {summary.signedIn ? summary.displayName.slice(0, 1).toUpperCase() : "?"}
              </div>
              <div>
                <p className="up-name">{summary.signedIn ? summary.displayName : "Welcome"}</p>
                <p className="up-sub">{summary.signedIn ? `Member since ${summary.memberSince}` : "Log in to see your account"}</p>
              </div>
            </div>
            <ul className="up-nav-list">
              {LINKS.slice(0, 3).map((item) => renderLink(item, badgeFor(item.key, summary), active))}
              {summary.signedIn && summary.adCount > 0 ? (
                <>
                  <li className="up-sec">Your ads</li>
                  {ADS_LINKS.map((item) => renderLink(item, item.key === "ads" ? summary.adCount : 0, active))}
                </>
              ) : null}
              <li className="up-sec">Account</li>
              {LINKS.slice(3).map((item) => renderLink(item, badgeFor(item.key, summary), active))}
            </ul>
          </nav>
          <div className="up-main">{children}</div>
          {aside ? <div className="up-aside">{aside}</div> : null}
        </div>
        {below ? <div className="up-below">{below}</div> : null}
      </div>
    </div>
  );
}

export function SignedOutPanel({ next, title, body }: { next: string; title: string; body: string }) {
  return (
    <section className="up-glass up-panel up-empty">
      <div className="up-empty-box" aria-hidden="true" />
      <h2 className="up-empty-title">{title}</h2>
      <p className="up-empty-body">{body}</p>
      <Link href={`/u/login/?next=${encodeURIComponent(next)}`} className="up-btn">
        Log in
      </Link>
    </section>
  );
}
