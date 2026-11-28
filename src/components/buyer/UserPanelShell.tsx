import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, Coins, Heart, House, Images, LifeBuoy, LogIn, Megaphone, MessageSquare, Search, Settings, Video, Wallet, type LucideIcon } from "lucide-react";
import { makeT } from "@/lib/ui/text";
import type { PanelSummary } from "@/server/notifications/summary";
import { AvatarContent } from "@/components/ui/AvatarContent";
import "./user-panel.css";

/** H7.6, H7.17: the panel frame for every /u/account page: left menu (the mockup's "My account") and the page body. */

export type PanelKey = "home" | "ads" | "media" | "saved" | "chats" | "calls" | "coins" | "earnings" | "notifications" | "alerts" | "support" | "settings";

type NavItem = { key: PanelKey; label: string; href: string; icon: LucideIcon };

const t = makeT();

const MAIN_LINKS: NavItem[] = [
  { key: "home", label: "Home", href: "/u/account/", icon: House },
  { key: "ads", label: "My ads", href: "/u/account/ads/", icon: Megaphone },
  { key: "media", label: "Photos and videos", href: "/u/account/media/", icon: Images },
  { key: "chats", label: "Chats", href: "/u/account/messages/", icon: MessageSquare },
  { key: "calls", label: "Video calls", href: "/u/account/calls/", icon: Video },
  { key: "saved", label: "Saved ads", href: "/u/account/saved/", icon: Heart },
];

const ACCOUNT_LINKS: NavItem[] = [
  { key: "coins", label: t("panel.nav.coins"), href: "/u/account/credits/", icon: Wallet },
  { key: "earnings", label: "Earnings", href: "/u/account/wallet/?tab=earnings", icon: Coins },
  { key: "notifications", label: "Notifications", href: "/u/account/notifications/", icon: Bell },
  { key: "alerts", label: "Saved search alerts", href: "/u/account/alerts/", icon: Search },
  { key: "support", label: "Help and support", href: "/u/account/support/", icon: LifeBuoy },
  { key: "settings", label: "Settings", href: "/u/account/edit-account/", icon: Settings },
];

function renderLink(item: NavItem, count: number, active: PanelKey, seller = false) {
  const Icon = item.icon;
  const on = item.key === active;
  return (
    <li key={item.key}>
      <Link href={item.href} className={on ? "up-nav-link up-nav-link-on" : "up-nav-link"} aria-current={on ? "page" : undefined}>
        <Icon size={18} aria-hidden="true" focusable="false" />
        {item.key === "home" && seller ? t("panel.nav.dashboard") : item.label}
        {count > 0 ? <span className="up-nav-badge">{count}</span> : null}
      </Link>
    </li>
  );
}

/** H19.5: My ads, Photos and videos and Earnings show only to vendors (an account with an ad, or with earnings). */
export function showsFor(key: PanelKey, summary: PanelSummary): boolean {
  if (key !== "ads" && key !== "media" && key !== "earnings") return true;
  return summary.signedIn && (summary.adCount > 0 || summary.hasEarnings);
}

/** Pure: the count shown beside a menu item. Zero shows nothing. */
export function badgeFor(key: PanelKey, summary: PanelSummary): number {
  if (!summary.signedIn) return 0;
  if (key === "ads") return summary.adCount;
  if (key === "chats") return summary.unreadChat;
  if (key === "support") return summary.unreadSupport;
  if (key === "calls") return summary.waitingCalls ?? 0;
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
                {summary.signedIn ? <AvatarContent src={summary.avatarUrl} fallback={summary.displayName.slice(0, 1).toUpperCase()} /> : "?"}
              </div>
              <div>
                <p className="up-name">{summary.signedIn ? summary.displayName : "Welcome"}</p>
                <p className="up-sub">{summary.signedIn ? `Member since ${summary.memberSince}` : "Log in to see your account"}</p>
              </div>
            </div>
            <ul className="up-nav-list">
              {MAIN_LINKS.filter((item) => showsFor(item.key, summary)).map((item) => renderLink(item, badgeFor(item.key, summary), active, summary.signedIn && summary.seller))}
              <li className="up-sec">Account</li>
              {ACCOUNT_LINKS.filter((item) => showsFor(item.key, summary)).map((item) => renderLink(item, badgeFor(item.key, summary), active))}
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

export function EmptyIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="up-empty-icon" aria-hidden="true">
      <Icon size={32} focusable="false" />
    </div>
  );
}

export function SignedOutPanel({ next, title, body }: { next: string; title: string; body: string }) {
  return (
    <section className="up-glass up-panel up-empty">
      <EmptyIcon icon={LogIn} />
      <h2 className="up-empty-title">{title}</h2>
      <p className="up-empty-body">{body}</p>
      <Link href={`/u/login/?next=${encodeURIComponent(next)}`} className="up-btn">
        Log in
      </Link>
    </section>
  );
}
