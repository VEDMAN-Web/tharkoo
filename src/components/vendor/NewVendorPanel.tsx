"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, friendlyError, hasSessionHint } from "@/lib/ui/api";
import { ownAdStatus } from "@/lib/ui/ad-status";
import { AdCard } from "../ui/AdCard";
import type { ListingDoc } from "@/lib/models";
import { displayTitle } from "@/lib/format";
import { AvailabilityBadge } from "../availability/AvailabilityBadge";
import type { PresenceStatus } from "@/server/availability/status";
import { OwnerActions } from "./OwnerActions";
import { SectionHelp } from "@/components/help/SectionHelp";
import { TourInbox } from "./TourInbox";
import { LogoutButton } from "@/components/auth/LogoutButton";

/** H7.5: the New design seller panel (the mockup's VendorPanel). Same data as the old panel, new look. */

type Me = { user: { displayName?: string; email?: string; verificationStatus?: string } };
type OwnItem = {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  slug?: string;
  expiresAt?: string | null;
  card?: ListingDoc;
  shown?: { views: number; clicks: number };
};
type OwnPage = {
  items: OwnItem[];
  total: number;
  counts: { all: number; live: number; review: number; ended: number };
  totals: { views: number; clicks: number };
};
type Presence = { available: boolean; status: PresenceStatus; callsAllowed: boolean; awayAfterHours: number; liveChat: boolean };
type Tab = "all" | "live" | "review" | "ended";

const PAGE_SIZE = 12;
const ACTIVITY_GAP_MS = 5 * 60 * 1000;
const TABS: { key: Tab; label: string; group?: "live" | "review" | "ended" }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live", group: "live" },
  { key: "review", label: "In review", group: "review" },
  { key: "ended", label: "Ended", group: "ended" },
];

function countFor(counts: OwnPage["counts"] | null, tab: Tab) {
  if (!counts) return "";
  return String(tab === "all" ? counts.all : counts[tab]);
}

export function NewVendorPanel({ initialTab = "all" }: { initialTab?: Tab }) {
  const [me, setMe] = useState<Me["user"] | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [page, setPage] = useState(1);
  const [pageData, setPageData] = useState<OwnPage | null>(null);
  const [items, setItems] = useState<OwnItem[]>([]);
  const [note, setNote] = useState("");
  const lastPing = useRef(0);

  const loadPage = useCallback(async (nextTab: Tab, nextPage: number, replace: boolean) => {
    const group = TABS.find((item) => item.key === nextTab)?.group;
    const query = new URLSearchParams({ pageSize: String(PAGE_SIZE), page: String(nextPage) });
    if (group) query.set("group", group);
    const res = await api<OwnPage>(`/api/listings?${query.toString()}`);
    if (!res.ok) {
      setNote(friendlyError(res.error));
      return;
    }
    setPageData(res.data);
    setItems((prev) => (replace ? res.data.items : [...prev, ...res.data.items]));
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!hasSessionHint()) {
        setSignedOut(true);
        return;
      }
      api<Me>("/api/auth/me").then((res) => {
        if (!res.ok) setSignedOut(true);
        else setMe(res.data.user);
      });
      api<Presence>("/api/availability").then((res) => {
        if (res.ok) setPresence(res.data);
      });
      api<{ balance: number }>("/api/wallet").then((res) => {
        if (res.ok) setBalance(res.data.balance);
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (signedOut) return;
    const id = window.setTimeout(() => void loadPage(tab, 1, true), 0);
    return () => window.clearTimeout(id);
  }, [tab, signedOut, loadPage]);

  /** Any use of the panel counts as activity. The server turns Online into Away after the admin's hours with none. */
  function onActivity() {
    const now = Date.now();
    if (now - lastPing.current < ACTIVITY_GAP_MS) return;
    lastPing.current = now;
    void api("/api/availability/activity", { method: "POST", body: "{}" });
  }

  async function toggleAvailable() {
    if (!presence) return;
    const res = await api<Presence>("/api/availability", { method: "PATCH", body: JSON.stringify({ available: !presence.available }) });
    if (res.ok) {
      setPresence(res.data);
      lastPing.current = Date.now();
      setNote(res.data.available ? "Buyers see Online now. They can call or chat." : "Buyers see Away. Calls are paused. Chat still works.");
    } else setNote(friendlyError(res.error));
  }

  /** H7.4c: the Live chat switch. On shows the badge and the chat button on this seller's ads. */
  async function toggleLiveChat() {
    if (!presence) return;
    const res = await api<Presence>("/api/availability/live-chat", { method: "PATCH", body: JSON.stringify({ liveChat: !presence.liveChat }) });
    if (res.ok) {
      setPresence(res.data);
      setNote(res.data.liveChat ? "Live chat is on. Your ads show Online now or Away, and a Chat online now button." : "Live chat is off. Your ads have no badge and no chat button.");
    } else setNote(friendlyError(res.error));
  }

  /** After an owner action: say what happened and reload the first page of this tab (counts come back with it). */
  async function reloadAfterAction(message: string) {
    setNote(message);
    setPage(1);
    await loadPage(tab, 1, true);
  }

  if (signedOut) {
    return (
      <div className="tkv-empty">
        <p>Sign in to see your ads and wallet.</p>
        <Link href="/u/login/?next=/u/account/" className="tkv-btn tkv-btn-primary">Log in</Link>
      </div>
    );
  }

  const name = me?.displayName || me?.email || "";
  const counts = pageData?.counts ?? null;
  const totals = pageData?.totals ?? null;
  const idChecked = me?.verificationStatus === "approved" || me?.verificationStatus === "verified";
  const profileSteps = [
    { label: "Name on your account", done: Boolean(me?.displayName), href: "/u/account/edit-account/" },
    { label: "ID checked", done: idChecked, href: "/u/account/kyc/" },
    { label: "A live ad", done: (counts?.live ?? 0) > 0, href: "/u/post-insert/" },
  ];
  const doneSteps = profileSteps.filter((step) => step.done).length;
  const percent = Math.round((doneSteps / profileSteps.length) * 100);
  const hasMore = pageData ? items.length < pageData.total : false;

  return (
    <div className="tkv-page" onPointerDown={onActivity} onKeyDown={onActivity}>
      <nav className="tkv-nav tkv-glass" aria-label="Panel">
        <div className="tkv-who">
          <span className="tkv-avatar" aria-hidden>{(name || "T").charAt(0).toUpperCase()}</span>
          <div>
            <p className="tkv-who-name">{name || "Your account"}</p>
            {presence ? <AvailabilityBadge status={presence.status} /> : null}
          </div>
        </div>
        <Link href="/u/account/" className="tkv-navlink tkv-navlink-on" aria-current="page">Dashboard</Link>
        <Link href="/u/account/ads/" className="tkv-navlink">My ads{counts ? <span className="tkv-count">{counts.all}</span> : null}</Link>
        <Link href="/u/account/media/" className="tkv-navlink">Photos &amp; videos</Link>
        <Link href="/u/account/wallet/" className="tkv-navlink">Wallet</Link>
        <Link href="/u/account/saved/" className="tkv-navlink">Saved</Link>
        <Link href="/u/account/edit-account/" className="tkv-navlink">Settings</Link>
        <LogoutButton className="tkv-navlink">Log out</LogoutButton>
      </nav>

      <main className="tkv-main">
        <section className="tkv-hero tkv-glass-strong" aria-labelledby="tkv-welcome">
          <div>
            <p className="tkv-kicker">Your panel</p>
            <h1 id="tkv-welcome" className="tkv-h1">{name ? `Welcome back, ${name.split(" ")[0]}` : "Welcome back"}</h1>
            <p className="tkv-lead">{counts ? `${counts.live} ${counts.live === 1 ? "ad is" : "ads are"} live.` : "Loading your ads."}</p>
            <SectionHelp textKey="help.section.availableNow" />
          </div>
          <div className="tkv-hero-actions">
            {presence ? (
              <button
                type="button"
                className={`tkv-avail ${presence.available ? "is-on" : ""}`}
                aria-pressed={presence.available}
                onClick={toggleAvailable}
              >
                <span className="tkv-avail-text">
                  <span className="tkv-avail-title">Available now</span>
                  <span className="tkv-avail-help">
                    {presence.available
                      ? presence.status === "online"
                        ? "Buyers see Online now and can call or chat."
                        : "Away (auto): no activity for a while. Any action brings you back online."
                      : "Away: you switched it off. Turn it on to show Online now."}
                  </span>
                </span>
                <span className="tkv-switch" aria-hidden><i /></span>
              </button>
            ) : null}
            {presence ? (
              <button type="button" className={`tkv-avail ${presence.liveChat ? "is-on" : ""}`} aria-pressed={presence.liveChat} onClick={toggleLiveChat}>
                <span className="tkv-avail-text">
                  <span className="tkv-avail-title">Live chat</span>
                  <span className="tkv-avail-help">{presence.liveChat ? "On: your ads show Online now or Away, and a chat button." : "Off: no badge and no chat button on your ads."}</span>
                </span>
                <span className="tkv-switch" aria-hidden><i /></span>
              </button>
            ) : null}
            <Link href="/u/post-insert/" className="tkv-btn tkv-btn-primary">Post an ad</Link>
          </div>
        </section>

        <section className="tkv-stats" aria-label="Your numbers">
          <div className="tkv-stat tkv-stat-rose">
            <p className="tkv-stat-label">Live ads</p>
            <p className="tkv-stat-value" data-count-up>{counts ? counts.live : "-"}</p>
          </div>
          <div className="tkv-stat tkv-stat-violet">
            <p className="tkv-stat-label">Views</p>
            <p className="tkv-stat-value" data-count-up>{totals ? totals.views.toLocaleString("en-IN") : "-"}</p>
            <p className="tkv-stat-foot">All time</p>
          </div>
          <div className="tkv-stat tkv-stat-sky">
            <p className="tkv-stat-label">Clicks</p>
            <p className="tkv-stat-value" data-count-up>{totals ? totals.clicks.toLocaleString("en-IN") : "-"}</p>
            <p className="tkv-stat-foot">All time</p>
          </div>
          <div className="tkv-stat tkv-stat-rose">
            <p className="tkv-stat-label">Coins</p>
            <p className="tkv-stat-value" data-count-up>{balance ?? "-"}</p>
          </div>
        </section>

        <section className="tkv-card tkv-glass" aria-labelledby="tkv-ads-title">
          <div className="tkv-card-head">
            <h2 id="tkv-ads-title" className="tkv-h2">My ads</h2>
            <SectionHelp textKey="help.section.myAds" />
            <div className="tkv-tabs" role="group" aria-label="Filter ads">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`tkv-tab ${tab === item.key ? "on" : ""}`}
                  aria-pressed={tab === item.key}
                  onClick={() => {
                    setItems([]);
                    setPage(1);
                    setTab(item.key);
                  }}
                >
                  {item.label} {countFor(counts, item.key)}
                </button>
              ))}
            </div>
          </div>
          {items.length === 0 && pageData ? (
            <p className="tkv-empty-line">No ads here yet. <Link href="/u/post-insert/">Post an ad</Link></p>
          ) : null}
          <div className="tkv-feed">
            {items.map((item) => {
              const status = ownAdStatus(item.status, item.expiresAt);
              const ad = (item.card ?? { slug: item.slug, title: displayTitle(item.title || ""), description: item.description, publicId: item.id, variant: "free" }) as ListingDoc;
              return (
                <AdCard
                  key={item.id}
                  ad={ad}
                  owner={{
                    label: status.label,
                    bg: status.bg,
                    fg: status.fg,
                    views: item.shown?.views ?? 0,
                    clicks: item.shown?.clicks ?? 0,
                    actions: <OwnerActions id={item.id} status={item.status} endsSoon={status.label === "Ending soon"} onDone={reloadAfterAction} />,
                  }}
                />
              );
            })}
          </div>
          {hasMore ? (
            <p className="tkv-more">
              <button type="button" className="tkv-btn tkv-btn-ghost" onClick={() => { const next = page + 1; setPage(next); void loadPage(tab, next, false); }}>
                Load more
              </button>
            </p>
          ) : null}
          <p className="tkv-note" aria-live="polite">{note}</p>
        </section>
        <TourInbox />
      </main>

      <aside className="tkv-aside">
        <section className="tkv-wallet" aria-labelledby="tkv-wallet-title">
          <p id="tkv-wallet-title" className="tkv-wallet-kicker">Wallet</p>
          <p className="tkv-wallet-value">{balance ?? "-"} coins</p>
          <p className="tkv-wallet-help">Coins buy promotions and video calls.</p>
          <SectionHelp textKey="help.section.wallet" tone="dark" />
          <div className="tkv-wallet-actions">
            <Link href="/u/account/wallet/" className="tkv-btn tkv-btn-light">Withdraw</Link>
            <Link href="/u/account/credits/" className="tkv-btn tkv-btn-outline">Buy coins</Link>
          </div>
        </section>
        <section className="tkv-card tkv-glass" aria-labelledby="tkv-profile-title">
          <h2 id="tkv-profile-title" className="tkv-h3">Your profile</h2>
          <p className="tkv-lead-small">{percent}% complete{percent < 100 ? ". Finish the steps below." : "."}</p>
          <div className="tkv-bar" role="progressbar" aria-label="Profile complete" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <i style={{ width: `${percent}%` }} />
          </div>
          <ul className="tkv-checklist">
            {profileSteps.map((step) => (
              <li key={step.label}>
                <span className={step.done ? "tkv-check is-done" : "tkv-check"} aria-hidden />
                {step.done ? <span>{step.label}</span> : <Link href={step.href}>{step.label}</Link>}
              </li>
            ))}
          </ul>
        </section>
        <p className="tkv-security">
          Scammers may pretend to be the Tharkoo team. Never send money or personal details to unofficial contacts. <Link href="/help/">Help Center</Link>
        </p>
      </aside>
    </div>
  );
}
