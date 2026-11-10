"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { VendorShell, Tile } from "./VendorShell";
import { api, hasSessionHint } from "@/lib/ui/api";
import { EmptyState } from "../ui/EmptyState";
import { displayTitle } from "@/lib/format";
import { readSaved, type SavedItem } from "../ui/SaveButton";
import { AdCard } from "../ui/AdCard";

type Me = { user: { displayName?: string; email?: string; verificationStatus?: string } };
type Own = { items: { id: string; title?: string; status?: string; slug?: string }[]; total: number };

export function Dashboard({ locked = false }: { locked?: boolean }) {
  const [name, setName] = useState("");
  const [ads, setAds] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!hasSessionHint()) {
        setSignedOut(true);
        return;
      }
      api<Me>("/api/auth/me").then((res) => {
        if (!res.ok) setSignedOut(true);
        else setName(res.data.user.displayName || res.data.user.email || "");
      });
      api<Own>("/api/listings").then((res) => {
        if (res.ok) setAds(res.data.total);
      });
      api<{ balance: number }>("/api/wallet").then((res) => {
        if (res.ok) setBalance(res.data.balance);
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <VendorShell title="Dashboard">
      {signedOut ? (
        <EmptyState title="Sign in to continue" body="Your dashboard loads after you log in." action={{ href: "/u/login/?next=/u/account/dashboard/", label: "Log in" }} />
      ) : (
        <>
          <p className="mb-4 t-body text-muted">{name ? `Hello, ${name}.` : "Loading your account…"}</p>
          {locked ? (
            <p className="mb-4 t-small text-gold">
              Verify your ID to publish. <Link href="/u/account/kyc/">Open verification</Link>
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Tile title="Ads" href="/u/account/ads/">
              {ads === null ? "Loading…" : `${ads} listings on your account`}
            </Tile>
            <Tile title="Wallet" href="/u/account/credits/">
              {balance === null ? "Loading…" : `${balance} credits`}
            </Tile>
            <Tile title="Saved" href="/u/account/saved/">
              Ads you save on this device
            </Tile>
            <Tile title="Verification" href="/u/account/kyc/">
              Check your ID status
            </Tile>
          </div>
        </>
      )}
    </VendorShell>
  );
}

export function AdsList() {
  const [rows, setRows] = useState<Own["items"] | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!hasSessionHint()) {
        setSignedOut(true);
        return;
      }
      api<Own>("/api/listings").then((res) => {
        if (!res.ok) setSignedOut(true);
        else setRows(res.data.items || []);
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <VendorShell title="Your ads">
      {signedOut ? (
        <EmptyState title="Sign in to see your ads" body="Drafts and live ads appear here after you log in." action={{ href: "/u/login/?next=/u/account/ads/", label: "Log in" }} />
      ) : rows && rows.length === 0 ? (
        <EmptyState title="No ads yet" body="Save a draft and it will show up here." action={{ href: "/u/post-insert/", label: "Post an ad" }} />
      ) : (
        <ul className="grid gap-3">
          {(rows || []).map((row) => (
            <li key={row.id} className="rounded-lg border border-line p-4">
              <p className="t-h3">{displayTitle(row.title) || "Untitled draft"}</p>
              <p className="t-small text-muted">{row.status}</p>
            </li>
          ))}
          {rows === null ? <li className="t-small text-muted">Loading…</li> : null}
        </ul>
      )}
    </VendorShell>
  );
}

export function SavedList() {
  const [items, setItems] = useState<SavedItem[] | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setItems(readSaved()), 0);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <VendorShell title="Saved">
      {items && items.length === 0 ? (
        <EmptyState title="Nothing saved yet" body="Tap the heart on a listing to keep it on this device." action={{ href: "/", label: "Browse listings" }} />
      ) : (
        <div className="grid gap-3">
          {(items || []).map((item) => (
            <AdCard
              key={item.id}
              ad={{ slug: item.slug, title: item.title, place: item.place, photos: item.photo ? [item.photo] : [], publicId: item.id }}
            />
          ))}
        </div>
      )}
    </VendorShell>
  );
}

export function Simple({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <VendorShell title={title}>
      <div className="t-body">{children}</div>
    </VendorShell>
  );
}
