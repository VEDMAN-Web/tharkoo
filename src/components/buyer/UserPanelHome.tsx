import Link from "next/link";
import { DiscoverFeed } from "./DiscoverFeed";
import { SavedAdsRail } from "./SavedAdsRail";
import { SignedOutPanel, UserPanelShell } from "./UserPanelShell";
import type { PackRow, PanelSummary } from "@/server/notifications/summary";
import styles from "./UserPanel.module.css";

/** H7.6: the user panel home (New design). Every number here comes from the server. */

type Option = { slug: string; name: string };

function inr(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function UserPanelHome({
  summary,
  packs,
  categories,
  cities,
}: {
  summary: PanelSummary;
  packs: PackRow[];
  categories: Option[];
  cities: Option[];
}) {
  return (
    <UserPanelShell active="home" summary={summary}>
      {summary.signedIn ? null : (
        <SignedOutPanel next="/u/account/dashboard/" title="Log in to see your panel" body="Your saved ads, chats and coins show here after you log in." />
      )}
      <section className={`${styles.hero}`} aria-labelledby="panel-hero">
        <p className={styles.eyebrow}>{summary.signedIn ? `Hello ${summary.displayName}` : "Welcome to Tharkoo"}</p>
        <h1 id="panel-hero" className={styles.h1}>Find it, save it, chat with the seller</h1>
        <p className={styles.lead}>Your saved ads, chats and coins in one place.</p>
      </section>

      <section aria-labelledby="buy-heading" className={`${styles.panel} ${styles.glass}`}>
        <div className={styles.panelHead}>
          <h2 id="buy-heading" className={styles.h2}>Buy coins</h2>
          <p className={styles.muted}>Packs on sale now</p>
        </div>
        {packs.length === 0 ? (
          <p className={styles.muted}>No coin packs are on sale right now.</p>
        ) : (
          <ul className={styles.packs} style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {packs.map((pack) => (
              <li key={pack.id}>
                <Link href="/u/account/credits/" className={styles.pack}>
                  {pack.tag ? <span className={styles.packTag}>{pack.tag}</span> : null}
                  <span className={styles.packCoins}>{pack.credits + (pack.bonus || 0)}</span>
                  <span className={styles.packUnit}>coins{pack.bonus ? ` (${pack.credits} + ${pack.bonus} free)` : ""}</span>
                  <span className={styles.packPrice}>{inr(pack.price)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={styles.homeGrid}>
        <SavedAdsRail />
        <div className={styles.stack}>
          <section aria-labelledby="coins-heading" className={`${styles.panel} ${styles.glass}`}>
            <h2 id="coins-heading" className={styles.h2}>Your coins</h2>
            {summary.signedIn ? (
              <>
                <p className={styles.stat}>{summary.balance}</p>
                <p className={styles.muted}>coins available</p>
              </>
            ) : (
              <p className={styles.muted}>Log in to see your coin balance.</p>
            )}
            <div style={{ marginTop: 14 }}>
              <Link href="/u/account/credits/history/" className={styles.link}>See history</Link>
            </div>
          </section>
          <section aria-labelledby="support-heading" className={`${styles.panel} ${styles.glass}`}>
            <h2 id="support-heading" className={styles.h2}>Help and support</h2>
            {summary.signedIn && summary.unreadSupport > 0 ? (
              <p className={styles.statRow}>
                <span>New reply on a ticket</span>
                <span className={styles.navBadge}>{summary.unreadSupport}</span>
              </p>
            ) : (
              <p className={styles.muted}>No new replies from support.</p>
            )}
            <div className={styles.filters} style={{ marginTop: 12 }}>
              <Link href="/u/account/support/" className={styles.ghost}>Open support</Link>
              <Link href="/u/account/support/new/" className={styles.ghost}>New ticket</Link>
            </div>
          </section>
        </div>
      </div>

      <DiscoverFeed categories={categories} cities={cities} />
    </UserPanelShell>
  );
}
