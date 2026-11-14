"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Megaphone, Settings, Ticket, UserRound, Wallet } from "lucide-react";
import { Suspense } from "react";
import { VendorShell } from "./VendorShell";
import { api, hasSessionHint } from "@/lib/ui/api";
import { EmptyState } from "../ui/EmptyState";
import { displayTitle } from "@/lib/format";
import { readSaved, type SavedItem } from "../ui/SaveButton";
import { RecentlyViewedRail } from "../ui/RecentlyViewed";
import { AdCard } from "../ui/AdCard";
import { HelpCard } from "../ui/HelpCard";
import { TourInbox } from "./TourInbox";
import type { ListingDoc } from "@/lib/models";

type Me = { user: { displayName?: string; email?: string; verificationStatus?: string } };
type Own = { items: { id: string; title?: string; status?: string; slug?: string; description?: string }[]; total: number };
type Entry = { id: string; delta: number; reason: string };

const UNPUBLISHED = new Set(["draft", "pending", "rejected", "paused", "expired"]);

function statusChip(status?: string) {
  if (status === "verified" || status === "approved") return { label: "ID verified", bg: "var(--ok-bg)", color: "var(--ok)" };
  if (status === "pending") return { label: "ID check pending", bg: "var(--warn-bg)", color: "var(--warn)" };
  return { label: "ID not submitted", bg: "var(--chip)", color: "var(--muted)" };
}

export function Dashboard({ locked = false }: { locked?: boolean }) {
  const [me, setMe] = useState<Me["user"] | null>(null);
  const [rows, setRows] = useState<Own["items"] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [used, setUsed] = useState<number | null>(null);
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
      api<Own>("/api/listings?pageSize=100").then((res) => {
        if (res.ok) setRows(res.data.items || []);
      });
      api<{ balance: number }>("/api/wallet").then((res) => {
        if (res.ok) setBalance(res.data.balance);
        else setBalance(null);
      });
      api<{ items: Entry[] }>("/api/wallet/entries").then((res) => {
        if (!res.ok) return setUsed(null);
        const spent = (res.data.items || []).filter((row) => row.delta < 0).reduce((sum, row) => sum + Math.abs(row.delta), 0);
        setUsed(spent);
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const active = rows?.filter((row) => row.status === "active").length;
  const hidden = rows?.filter((row) => UNPUBLISHED.has(row.status || "")).length;
  const chip = statusChip(me?.verificationStatus);
  const num = (value: number | null | undefined) => (value === null || value === undefined ? "-" : String(value));

  return (
    <VendorShell>
      <h1 className="tk-page-h1">Dashboard</h1>
      {signedOut ? (
        <EmptyState title="Sign in to continue" body="Your dashboard loads after you log in." action={{ href: "/u/login/?next=/u/account/dashboard/", label: "Log in" }} />
      ) : (
        <>
          {locked ? (
            <p className="t-small" style={{ textAlign: "center" }}>
              Verify your ID to publish. <Link href="/u/account/kyc/">Open verification</Link>
            </p>
          ) : null}
          <div className="tk-dash">
            <div className="tk-dcard" data-tk="tile" data-tile="ads">
              <h2><Megaphone size={20} aria-hidden /> Your ads</h2>
              <div className="tk-dcard-body">
                <p className="tk-count-row">Active <span className="tk-count">{num(active ?? null)}</span></p>
                <p className="tk-count-row">Not published <span className="tk-count">{num(hidden ?? null)}</span></p>
              </div>
              <div className="tk-dcard-actions">
                <Link href="/u/post-insert/" className="tk-btn tk-btn-gold">Post an ad</Link>
                <Link href="/u/account/ads/" className="tk-dlink">See all ads</Link>
              </div>
            </div>
            <div className="tk-dcard" data-tk="tile" data-tile="wallet">
              <h2><Wallet size={20} aria-hidden /> Wallet</h2>
              <div className="tk-dcard-body">
                <p className="tk-count-row">Available <span className="tk-count">{num(balance)}</span></p>
                <p className="tk-count-row">Used <span className="tk-count">{num(used)}</span></p>
              </div>
              <div className="tk-dcard-actions">
                <Link href="/u/account/credits/" className="tk-btn tk-btn-gold">Buy credits</Link>
              </div>
            </div>
            <div className="tk-dcard" data-tk="tile" data-tile="profile">
              <h2><UserRound size={20} aria-hidden /> Profile</h2>
              <div className="tk-dcard-body">
                <p style={{ fontWeight: 700, overflowWrap: "anywhere" }}>{me?.displayName || me?.email || "…"}</p>
                <p className="t-small" style={{ color: "var(--muted)", overflowWrap: "anywhere" }}>{me?.email}</p>
                <span className="tk-chip" style={{ background: chip.bg, color: chip.color, marginTop: 8 }}>{chip.label}</span>
              </div>
              <div className="tk-dcard-actions">
                <Link href="/u/account/kyc/" className="tk-btn tk-btn-outline-gold">{chip.label !== "ID verified" ? "Verify your ID" : "View verification"}</Link>
              </div>
            </div>
            <div className="tk-dcard" data-tk="tile" data-tile="coupons">
              <h2><Ticket size={20} aria-hidden /> Coupons</h2>
              <div className="tk-dcard-body">
                <p className="t-small">Manage your coupons.</p>
              </div>
              <div className="tk-dcard-actions">
                <Link href="/u/account/coupons/" className="tk-btn tk-btn-outline-gold">Open coupons</Link>
              </div>
            </div>
            <div className="tk-dcard" data-tk="tile" data-tile="settings">
              <h2><Settings size={20} aria-hidden /> Settings</h2>
              <div className="tk-dcard-body">
                <p className="t-small">Manage your personal info.</p>
              </div>
              <div className="tk-dcard-actions">
                <Link href="/u/account/edit-account/" className="tk-btn tk-btn-outline-gold">Open settings</Link>
              </div>
            </div>
          </div>
          <TourInbox />
          <aside className="tk-security" data-tk="security-tips">
            <p>
              <strong>Security tips:</strong> Scammers may pretend to be the Tharkoo team to ask for money. Never send payments or personal information to unofficial contacts.{" "}
              <Link href="/help/">Visit our Help Center to learn more.</Link>
            </p>
          </aside>
          <HelpCard />
        </>
      )}
    </VendorShell>
  );
}

function AdsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") === "unpublished" ? "unpublished" : "active";
  const [rows, setRows] = useState<Own["items"] | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!hasSessionHint()) {
        setSignedOut(true);
        return;
      }
      api<Own>("/api/listings?pageSize=100").then((res) => {
        if (!res.ok) setSignedOut(true);
        else setRows(res.data.items || []);
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const active = (rows || []).filter((row) => row.status === "active");
  const hidden = (rows || []).filter((row) => UNPUBLISHED.has(row.status || ""));
  const shown = tab === "active" ? active : hidden;

  async function act(id: string, action: "pause" | "resume" | "renew" | "duplicate" | "delete") {
    if (action === "delete" && !window.confirm("Delete this ad?")) return;
    const res = action === "delete"
      ? await api(`/api/listings/${id}`, { method: "DELETE" })
      : await api(`/api/listings/${id}/${action}`, { method: "POST", body: "{}" });
    setNote(res.ok ? "Updated." : "That action could not be completed.");
    if (res.ok) {
      const again = await api<Own>("/api/listings?pageSize=100");
      if (again.ok) setRows(again.data.items || []);
    }
  }

  return (
    <VendorShell>
      <h1 className="tk-page-h1">Your Ads</h1>
      {signedOut ? (
        <EmptyState title="Sign in to see your ads" body="Drafts and live ads appear here after you log in." action={{ href: "/u/login/?next=/u/account/ads/", label: "Log in" }} />
      ) : (
        <>
          <div className="tk-tabs" role="tablist">
            <button type="button" role="tab" data-tk="tab" aria-selected={tab === "active"} onClick={() => router.replace("/u/account/ads/?tab=active")}>
              <sup>{active.length}</sup> Active
            </button>
            <button type="button" role="tab" data-tk="tab" aria-selected={tab === "unpublished"} onClick={() => router.replace("/u/account/ads/?tab=unpublished")}>
              <sup>{hidden.length}</sup> Not published
            </button>
          </div>
          <p className="t-small" style={{ margin: "14px 0" }}>
            You have <strong>{tab === "active" ? active.length : hidden.length} {tab === "active" ? "active" : "not published"} ads</strong>
          </p>
          {shown.length === 0 ? (
            <p>
              <Link href="/u/post-insert/" style={{ color: "var(--accent)" }}>Post an ad</Link>
            </p>
          ) : (
            <div className="tk-feed">
              {shown.map((row) => (
                <div key={row.id}>
                  <AdCard ad={{ slug: row.slug, title: displayTitle(row.title), description: row.description, publicId: row.id, variant: "free" } as ListingDoc} />
                  <p style={{ display: "flex", gap: 12, fontSize: 13 }}>
                    <Link href={`/u/post-insert/?draft=${row.id}`} style={{ color: "var(--accent)" }}>Edit</Link>
                    <button type="button" style={{ color: "var(--accent)", background: "none", border: 0 }} onClick={() => act(row.id, row.status === "active" ? "pause" : "resume")}>Pause</button>
                    <button type="button" style={{ color: "var(--accent)", background: "none", border: 0 }} onClick={() => act(row.id, "renew")}>Renew</button>
                    <button type="button" style={{ color: "var(--accent)", background: "none", border: 0 }} onClick={() => act(row.id, "duplicate")}>Duplicate</button>
                    <button type="button" style={{ color: "var(--accent)", background: "none", border: 0 }} onClick={() => act(row.id, "delete")}>Delete</button>
                  </p>
                </div>
              ))}
            </div>
          )}
          <p aria-live="polite" className="t-small">{note}</p>
          <HelpCard />
        </>
      )}
    </VendorShell>
  );
}

export function AdsList() {
  return (
    <Suspense fallback={<p className="tk-container">Loading…</p>}>
      <AdsInner />
    </Suspense>
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
            <AdCard key={item.id} ad={{ slug: item.slug, title: item.title, place: item.place, photos: item.photo ? [item.photo] : [], publicId: item.id }} />
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
