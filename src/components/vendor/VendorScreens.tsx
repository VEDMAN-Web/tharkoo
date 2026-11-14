"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { VendorShell } from "./VendorShell";
import { api, hasSessionHint } from "@/lib/ui/api";
import { EmptyState } from "../ui/EmptyState";
import { readSaved, type SavedItem } from "../ui/SaveButton";
import { RecentlyViewedRail } from "../ui/RecentlyViewed";
import { AdCard } from "../ui/AdCard";
import { HelpCard } from "../ui/HelpCard";
import { UnreadBadge } from "../chat/UnreadBadge";
import { TourInbox } from "./TourInbox";
import { OwnAds, type OwnPage } from "./OwnAds";
import type { ListingDoc } from "@/lib/models";

type Me = { user: { displayName?: string; email?: string; verificationStatus?: string } };
type Counts = OwnPage["counts"];

const VERIFIED = new Set(["verified", "approved"]);

/** H6.19 profile progress: three checks, each from data the panel already has. */
export function profileChecks(user: Me["user"] | null, counts: Counts | null) {
  return [
    { label: "Add your name", done: Boolean(user?.displayName) },
    { label: "Verify your ID", done: VERIFIED.has(user?.verificationStatus ?? "") },
    { label: "Post your first ad", done: (counts?.all ?? 0) > 0 },
  ];
}

const num = (value: number | null | undefined) => (value === null || value === undefined ? "-" : value.toLocaleString("en-IN"));

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone: "rose" | "violet" | "sky" | "gold" }) {
  return (
    <div className={`tk-glass tk-v-stat tk-v-stat-${tone}`}>
      <p className="tk-v-stat-label">{label}</p>
      <p className="tk-v-stat-value">{value}</p>
      {hint ? <p className="tk-v-stat-hint">{hint}</p> : null}
    </div>
  );
}

export function Dashboard({ locked = false }: { locked?: boolean }) {
  const [me, setMe] = useState<Me["user"] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [page, setPage] = useState<OwnPage | null>(null);
  const [signedOut, setSignedOut] = useState(false);

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
      api<{ balance: number }>("/api/wallet").then((res) => setBalance(res.ok ? res.data.balance : null));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const counts = page?.counts ?? null;
  const checks = profileChecks(me, counts);
  const doneChecks = checks.filter((check) => check.done).length;
  const percent = Math.round((doneChecks / checks.length) * 100);

  if (signedOut) {
    return (
      <VendorShell>
        <EmptyState title="Sign in to continue" body="Your dashboard loads after you log in." action={{ href: "/u/login/?next=/u/account/dashboard/", label: "Log in" }} />
      </VendorShell>
    );
  }

  return (
    <VendorShell>
      <section className="tk-glass tk-v-welcome" aria-label="Welcome">
        <div>
          <p className="tk-v-eyebrow">Your panel</p>
          <h1 className="tk-v-title">{me?.displayName ? `Welcome back, ${me.displayName}` : "Welcome back"}</h1>
          <p className="tk-v-lede">{counts ? `${counts.live} ads are live. ${counts.review} in review.` : "Loading your ads…"}</p>
          {locked ? (
            <p className="tk-v-lede">
              Verify your ID to publish. <Link href="/u/account/kyc/">Open verification</Link>
            </p>
          ) : null}
        </div>
        <Link href="/u/post-insert/" className="tk-v-cta">Post an ad</Link>
      </section>

      <section aria-label="Your numbers" className="tk-v-stats">
        <Stat label="Live ads" value={num(counts?.live)} tone="rose" />
        <Stat label="Views" value={num(page?.totals.views)} hint="All time" tone="violet" />
        <Stat label="Clicks" value={num(page?.totals.clicks)} hint="All time" tone="sky" />
        <Stat label="Coins" value={num(balance)} hint="Available" tone="gold" />
      </section>

      <div className="tk-v-grid">
        <section className="tk-glass tk-v-panel" aria-labelledby="my-ads-heading">
          <div className="tk-v-head">
            <h2 id="my-ads-heading">My ads</h2>
            <Link href="/u/account/ads/" className="tk-v-link">See all ads</Link>
          </div>
          <OwnAds compact onLoaded={setPage} />
        </section>

        <aside className="tk-v-side" aria-label="Wallet, messages and profile">
          <section className="tk-v-wallet" aria-labelledby="wallet-heading">
            <h2 id="wallet-heading">Wallet</h2>
            <p className="tk-v-big">{num(balance)}</p>
            <p className="tk-v-wallet-note">Available coins</p>
            <div className="tk-v-wallet-actions">
              <Link href="/u/account/credits/bank/" className="tk-v-pill tk-v-pill-light">Withdraw</Link>
              <Link href="/u/account/credits/history/" className="tk-v-pill tk-v-pill-ghost">History</Link>
            </div>
          </section>

          <section className="tk-glass tk-v-panel" aria-labelledby="chats-heading">
            <div className="tk-v-head">
              <h2 id="chats-heading">Chats</h2>
              <Link href="/u/account/messages/" className="tk-v-link">Open chats <UnreadBadge /></Link>
            </div>
          </section>

          <section className="tk-glass tk-v-panel" aria-labelledby="profile-heading">
            <h2 id="profile-heading">Your profile</h2>
            <p className="tk-v-lede">{percent}% complete{percent < 100 ? ". Finish these to get more replies." : "."}</p>
            <div className="tk-v-progress" role="progressbar" aria-label="Profile progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
              <i style={{ width: `${percent}%` }} />
            </div>
            <ul className="tk-v-checks">
              {checks.map((check) => (
                <li key={check.label} data-done={check.done ? "1" : "0"}>
                  {check.done ? "Done: " : "To do: "}
                  {check.label}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      <TourInbox />
      <aside className="tk-security" data-tk="security-tips">
        <p>
          <strong>Security tips:</strong> Scammers may pretend to be the Tharkoo team to ask for money. Never send payments or personal information to unofficial contacts.{" "}
          <Link href="/help/">Visit our Help Center to learn more.</Link>
        </p>
      </aside>
      <HelpCard />
    </VendorShell>
  );
}

export function AdsList() {
  const [signedOut, setSignedOut] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!hasSessionHint()) setSignedOut(true);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <VendorShell>
      <div className="tk-v-head tk-v-head-page">
        <h1 className="tk-page-h1">Your ads</h1>
        <Link href="/u/post-insert/" className="tk-v-cta">Post an ad</Link>
      </div>
      {!ready ? null : signedOut ? (
        <EmptyState title="Sign in to see your ads" body="Drafts and live ads appear here after you log in." action={{ href: "/u/login/?next=/u/account/ads/", label: "Log in" }} />
      ) : (
        <section className="tk-glass tk-v-panel">
          <OwnAds />
        </section>
      )}
      <HelpCard />
    </VendorShell>
  );
}

export function SavedList() {
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => {
    const id = window.setTimeout(() => setItems(readSaved()), 0);
    return () => window.clearTimeout(id);
  }, []);
  const cards = useMemo(() => items || [], [items]);
  return (
    <VendorShell>
      <h1 className="tk-page-h1">Saved</h1>
      {cards.length === 0 ? (
        <EmptyState title="Nothing saved yet" body="Saved ads on this device show up here." action={{ href: "/", label: "Browse listings" }} />
      ) : (
        <div className="tk-feed">
          {cards.map((item) => (
            <AdCard key={item.id} ad={{ slug: item.slug, title: item.title, place: item.place, photos: item.photo ? [item.photo] : [], publicId: item.id } as ListingDoc} />
          ))}
        </div>
      )}
      <form
        className="mt-6 grid max-w-md gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const res = await api("/api/alerts/", {
            method: "POST",
            body: JSON.stringify({
              email: String(form.get("email") || ""),
              q: String(form.get("q") || ""),
              city: String(form.get("city") || ""),
            }),
          });
          setNote(res.ok ? "Search saved. Email alerts use the mailer when a key is set." : "Could not save that search.");
        }}
      >
        <h2 className="t-h3">Saved search</h2>
        <input name="email" type="email" required placeholder="Email" className="rounded border px-3 py-2" />
        <input name="q" placeholder="Words" className="rounded border px-3 py-2" />
        <input name="city" placeholder="City" className="rounded border px-3 py-2" />
        <button type="submit" className="tk-btn tk-btn-primary w-fit">Email me new matches</button>
        {note ? <p>{note}</p> : null}
      </form>
      <RecentlyViewedRail />
      <HelpCard />
    </VendorShell>
  );
}

export function Simple({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <VendorShell>
      <h1 className="tk-page-h1">{title}</h1>
      <div className="t-body">{children}</div>
      <HelpCard />
    </VendorShell>
  );
}
