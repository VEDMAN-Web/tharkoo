import Link from "next/link";
import type { ReactNode } from "react";
import type { PanelSummary } from "@/server/notifications/summary";
import styles from "./UserPanel.module.css";

/** H7.6: the panel frame for the New design: left menu (the mockup's "My account") and the page body. */

export type PanelKey = "home" | "saved" | "chats" | "coins" | "notifications" | "alerts" | "support" | "settings";

const LINKS: { key: PanelKey; label: string; href: string }[] = [
  { key: "home", label: "Home", href: "/u/account/dashboard/" },
  { key: "saved", label: "Saved ads", href: "/u/account/saved/" },
  { key: "chats", label: "Chats", href: "/u/account/messages/" },
  { key: "coins", label: "Coins and payments", href: "/u/account/credits/" },
  { key: "notifications", label: "Notifications", href: "/u/account/notifications/" },
  { key: "alerts", label: "Saved search alerts", href: "/u/account/alerts/" },
  { key: "support", label: "Help and support", href: "/u/account/support/" },
  { key: "settings", label: "Settings", href: "/u/account/edit-account/" },
];

/** Pure: the count shown beside a menu item. Zero shows nothing. */
export function badgeFor(key: PanelKey, summary: PanelSummary): number {
  if (!summary.signedIn) return 0;
  if (key === "chats") return summary.unreadChat;
  if (key === "support") return summary.unreadSupport;
  if (key === "notifications") return summary.unreadChat + summary.unreadSupport;
  return 0;
}

export function UserPanelShell({ active, summary, children }: { active: PanelKey; summary: PanelSummary; children: ReactNode }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.layout}>
        <nav aria-label="My account" className={`${styles.nav} ${styles.glass}`}>
          <div className={styles.navHead}>
            <div className={styles.avatar} aria-hidden="true">
              {summary.signedIn ? summary.displayName.slice(0, 1).toUpperCase() : "?"}
            </div>
            <div>
              <p className={styles.navName}>{summary.signedIn ? summary.displayName : "Welcome"}</p>
              <p className={styles.navSub}>{summary.signedIn ? summary.email : "Log in to see your account"}</p>
            </div>
          </div>
          <ul className={styles.navList}>
            {LINKS.map((item) => {
              const badge = badgeFor(item.key, summary);
              const on = item.key === active;
              return (
                <li key={item.key}>
                  <Link href={item.href} className={`${styles.navLink} ${on ? styles.navLinkOn : ""}`} aria-current={on ? "page" : undefined}>
                    {item.label}
                    {badge > 0 ? (
                      <span className={styles.navBadge}>
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className={styles.main}>
          <div className={styles.topStrip}>
            {summary.signedIn ? (
              <span className={styles.coinChip} data-tk="coin-balance">
                {summary.balance} coins
              </span>
            ) : (
              <Link href="/u/login/?next=/u/account/dashboard/" className={styles.cta}>
                Log in
              </Link>
            )}
            <Link href="/u/account/credits/" className={styles.cta}>
              Buy coins
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function SignedOutPanel({ next, title, body }: { next: string; title: string; body: string }) {
  return (
    <section className={`${styles.panel} ${styles.glass} ${styles.empty}`}>
      <h2 className={styles.emptyTitle}>{title}</h2>
      <p className={styles.emptyBody}>{body}</p>
      <Link href={`/u/login/?next=${encodeURIComponent(next)}`} className={styles.cta}>
        Log in
      </Link>
    </section>
  );
}
