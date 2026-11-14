import Link from "next/link";
import { SignedOutPanel } from "./UserPanelShell";
import type { NotificationItem } from "@/server/notifications/feed";
import styles from "./UserPanel.module.css";

/** H7.6: the Notifications list. Items come from real sources (support, chats, coins). */

const KIND_LABEL: Record<NotificationItem["kind"], string> = { support: "Support", chat: "Chat", coins: "Coins" };

export function NotificationsPanel({ items }: { items: NotificationItem[] | null }) {
  if (items === null) {
    return <SignedOutPanel next="/u/account/notifications/" title="Log in to see notifications" body="Replies, chat messages and coin updates show here after you log in." />;
  }
  return (
    <section aria-labelledby="notif-heading" className={`${styles.panel} ${styles.glass}`}>
      <h2 id="notif-heading" className={styles.h2}>Notifications</h2>
      {items.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No notifications yet</p>
          <p className={styles.emptyBody}>Support replies, unread chats and coin updates will show here.</p>
          <Link href="/u/account/dashboard/" className={styles.ghost}>Back to my panel</Link>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} style={{ display: "block", minHeight: 44, padding: "12px 14px", borderRadius: 16, background: "#fff", border: "1px solid #ead8f0", color: "#1e0b38", textDecoration: "none" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#a8124f" }}>{KIND_LABEL[item.kind]}</span>
                <span style={{ display: "block", fontWeight: 700 }}>{item.title}</span>
                <span style={{ display: "block", fontSize: 14, color: "#4a2870", overflowWrap: "anywhere" }}>{item.body}</span>
                {item.at ? <time dateTime={item.at} style={{ fontSize: 12, color: "#4a2870" }}>{new Date(item.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</time> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
