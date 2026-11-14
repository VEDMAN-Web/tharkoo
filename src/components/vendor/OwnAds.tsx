"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, friendlyError } from "@/lib/ui/api";
import { ownAdStatus } from "@/lib/ui/ad-status";
import { AdCard } from "../ui/AdCard";
import type { ListingDoc } from "@/lib/models";

export type OwnTab = "all" | "live" | "review" | "ended";

export const OWN_TABS: { key: OwnTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "review", label: "In review" },
  { key: "ended", label: "Ended" },
];

const PAGE_SIZE = 12;

export interface OwnItem {
  id: string;
  slug: string | null;
  status: string;
  expiresAt: string | null;
  card: ListingDoc;
}

/** One page from GET /api/listings. Counts and totals cover every ad the owner has. */
export interface OwnPage {
  items: OwnItem[];
  total: number;
  counts: { all: number; live: number; review: number; ended: number };
  totals: { views: number; clicks: number };
}

type Action = "pause" | "resume" | "renew" | "duplicate" | "delete";

export function ownListPath(tab: OwnTab, page: number) {
  const group = tab === "all" ? "" : `&group=${tab}`;
  return `/api/listings?pageSize=${PAGE_SIZE}&page=${page}${group}`;
}

/**
 * H6.19 "Your ads": the owner's ads as the shared listing card, with a status label and owner actions.
 * Tabs filter on the server. "Load more" adds the next page. Views and clicks from this feed are never counted.
 */
export function OwnAds({ onLoaded, compact = false }: { onLoaded?: (page: OwnPage) => void; compact?: boolean }) {
  const [tab, setTab] = useState<OwnTab>("all");
  const [items, setItems] = useState<OwnItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [counts, setCounts] = useState<OwnPage["counts"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState("");
  const latest = useRef(0);
  const router = useRouter();

  async function load(next: OwnTab, nextPage: number) {
    const mine = ++latest.current;
    setLoading(true);
    const res = await api<OwnPage>(ownListPath(next, nextPage));
    if (mine !== latest.current) return;
    setLoading(false);
    if (!res.ok) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setItems((prev) => (nextPage === 1 ? res.data.items : [...prev, ...res.data.items]));
    setTotal(res.data.total);
    setCounts(res.data.counts);
    setPage(nextPage);
    onLoaded?.(res.data);
  }

  useEffect(() => {
    const id = window.setTimeout(() => void load(tab, 1), 0);
    return () => window.clearTimeout(id);
    // Reload when the tab changes only.
  }, [tab]);

  async function act(item: OwnItem, action: Action) {
    if (action === "delete" && !window.confirm("Delete this ad?")) return;
    setBusyId(item.id);
    setNote("");
    const res = await api<{ id?: string }>(
      action === "delete" ? `/api/listings/${item.id}` : `/api/listings/${item.id}/${action}`,
      action === "delete" ? { method: "DELETE" } : { method: "POST", body: "{}" },
    );
    setBusyId("");
    if (!res.ok) return setNote(friendlyError(res.error) || "That action could not be completed.");
    if (action === "duplicate" && res.data?.id) {
      router.push(`/u/post-insert/?draft=${res.data.id}`);
      return;
    }
    setNote(action === "renew" ? "Renewed." : action === "delete" ? "Deleted." : "Updated.");
    await load(tab, 1);
  }

  const shownCount = (key: OwnTab) => (counts ? counts[key] : null);

  return (
    <div className="tk-own" data-compact={compact ? "1" : undefined}>
      <div className="tk-own-tabs" role="tablist" aria-label="Filter your ads">
        {OWN_TABS.map((item) => {
          const n = shownCount(item.key);
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              data-tk="tab"
              aria-selected={tab === item.key}
              className="tk-own-tab"
              onClick={() => setTab(item.key)}
            >
              {item.label}
              {n === null ? "" : <span className="tk-own-count">{n}</span>}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="tk-own-note">{note}</p>
      {failed ? <p className="tk-own-note">Your ads could not be loaded. Try again in a moment.</p> : null}
      {!loading && !failed && items.length === 0 ? (
        <div className="tk-own-empty" data-tk="own-empty">
          <p>No ads here yet.</p>
          <Link href="/u/post-insert/" className="tk-own-cta">Post an ad</Link>
        </div>
      ) : null}
      <div className="tk-feed" data-tk="own-list">
        {items.map((item) => (
          <AdCard
            key={item.id}
            ad={item.card}
            owner
            ownerStatus={ownAdStatus(item.status, item.expiresAt)}
            ownerActions={<OwnActions item={item} busy={busyId === item.id} onAct={act} />}
          />
        ))}
      </div>
      {items.length < total ? (
        <div className="tk-own-more-row">
          <button type="button" className="tk-own-cta" disabled={loading} onClick={() => void load(tab, page + 1)}>
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function OwnActions({ item, busy, onAct }: { item: OwnItem; busy: boolean; onAct: (item: OwnItem, action: Action) => void }) {
  const paused = item.status === "paused";
  return (
    <div className="tk-own-actions-row">
      <Link className="tk-own-btn" href={`/u/post-insert/?draft=${item.id}`}>Edit</Link>
      <button type="button" className="tk-own-btn" disabled={busy} onClick={() => onAct(item, "renew")}>Renew</button>
      <Link className="tk-own-btn" href="/u/account/credits/">Promote</Link>
      <button type="button" className="tk-own-btn" disabled={busy} onClick={() => onAct(item, "duplicate")}>Post again</button>
      <details className="tk-own-more">
        <summary>More</summary>
        <button type="button" className="tk-own-btn" disabled={busy} onClick={() => onAct(item, paused ? "resume" : "pause")}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" className="tk-own-btn" disabled={busy} onClick={() => onAct(item, "delete")}>Delete</button>
      </details>
    </div>
  );
}
