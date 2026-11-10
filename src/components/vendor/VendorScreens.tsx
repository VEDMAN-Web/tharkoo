"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Megaphone, Settings, Star, Ticket } from "lucide-react";
import { Suspense } from "react";
import { VendorShell } from "./VendorShell";
import { api, hasSessionHint } from "@/lib/ui/api";
import { EmptyState } from "../ui/EmptyState";
import { displayTitle } from "@/lib/format";
import { readSaved, type SavedItem } from "../ui/SaveButton";
import { AdCard } from "../ui/AdCard";
import { HelpCard } from "../ui/HelpCard";
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
  const num = (value: number | null | undefined) => (value === null || value === undefined ? "–" : String(value));

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
            <Link href="/u/account/kyc/" className="tk-profile" style={{ gridColumn: 3, gridRow: "1 / span 2" }}>
              <p style={{ fontWeight: 700 }}>{me?.displayName || me?.email || "…"}</p>
              <p className="t-small" style={{ color: "var(--muted)" }}>{me?.email}</p>
              <span className="tk-chip" style={{ background: chip.bg, color: chip.color, marginTop: 8 }}>{chip.label}</span>
              {chip.label !== "ID verified" ? <p style={{ marginTop: 8, color: "var(--accent)" }}>Verify your ID</p> : null}
            </Link>
            <Link href="/u/account/ads/" className="tk-tile-link" data-tk="tile" data-tile="ads" style={{ gridColumn: 1, gridRow: 1 }}>
              <h2>Ads <ChevronRight size={16} /></h2>
              <p className="tk-count-row">Active <span className="tk-count">{num(active ?? null)}</span></p>
              <p className="tk-count-row">Not published <span className="tk-count">{num(hidden ?? null)}</span></p>
            </Link>
            <div className="tk-tile-link" data-tk="tile" data-tile="wallet" style={{ gridColumn: 2, gridRow: 1 }}>
              <Link href="/u/account/credits/">
                <h2 style={{ color: "var(--accent)", display: "flex", justifyContent: "space-between" }}>Wallet <ChevronRight size={16} /></h2>
              </Link>
              <p className="tk-count-row">Available <span className="tk-count">{num(balance)}</span></p>
              <p className="tk-count-row">Used <span className="tk-count">{num(used)}</span></p>
              <Link href="/u/account/credits/" className="tk-btn tk-btn-rose tk-btn-sm">BUY CREDITS</Link>
            </div>
            <Link href="/u/account/coupons/" className="tk-tile-link" data-tk="tile" data-tile="coupons" style={{ gridColumn: 1, gridRow: 2 }}>
              <h2><Ticket size={14} /> Coupons <ChevronRight size={16} /></h2>
              <p className="t-small">Manage your coupons</p>
            </Link>
            <Link href="/u/account/edit-account/" className="tk-tile-link" data-tk="tile" data-tile="settings" style={{ gridColumn: 2, gridRow: 2 }}>
              <h2><Settings size={14} /> Settings <ChevronRight size={16} /></h2>
              <p className="t-small">Manage your personal info.</p>
            </Link>
            <article className="tk-news" style={{ gridColumn: 1, gridRow: 3 }}>
              <p style={{ color: "var(--accent)", fontWeight: 600, fontSize: 13 }}><Megaphone size={14} /> Tharkoo News</p>
              <p className="t-small">Marketing communications active</p>
              <p className="t-small">You&apos;ll receive <strong>exclusive offers, promotions, and news</strong> from Tharkoo.</p>
            </article>
            <article className="tk-security" data-tk="security-tips" style={{ gridColumn: 2, gridRow: 3 }}>
              <span className="tk-security-tab">SECURITY TIPS</span>
              <h3>Security tips</h3>
              <p>Scammers may pretend to be the Tharkoo team to ask for money. Never send payments or personal information to unofficial contacts.</p>
              <p><Link href="/help/" style={{ color: "var(--metal-soft)", fontWeight: 700 }}>Visit our Help Center to learn more.</Link></p>
            </article>
            <article className="tk-star-card" style={{ gridColumn: 3, gridRow: 3, border: "1px solid var(--border)", borderRadius: 8 }}>
              <Star color="#E9C27A" />
              <p style={{ fontWeight: 700, fontSize: 12 }}>Stand out with the new Star!</p>
              <p className="t-small" style={{ color: "var(--muted)" }}>Catch attention like never before. Promote your ad in a premium format that always puts you front and center.</p>
              <Link href="/help/" style={{ color: "var(--accent)" }}>Learn more</Link>
            </article>
          </div>
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
