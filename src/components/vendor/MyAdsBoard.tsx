"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, friendlyError } from "@/lib/ui/api";
import { draftPath, ownAdStatus } from "@/lib/ui/ad-status";
import { AdCard } from "../ui/AdCard";
import type { ListingDoc } from "@/lib/models";
import { displayTitle } from "@/lib/format";
import { OwnerActions } from "./OwnerActions";
import { usePresenceActivity } from "./AvailabilityControls";
import { PostStrip } from "../ui/PostStrip";
import { makeT } from "@/lib/ui/text";

const t = makeT();

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
type Tab = "all" | "live" | "review" | "ended";

const PAGE_SIZE = 12;
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

export function MyAdsBoard({ initialTab = "all" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [page, setPage] = useState(1);
  const [pageData, setPageData] = useState<OwnPage | null>(null);
  const [items, setItems] = useState<OwnItem[]>([]);
  const [note, setNote] = useState("");
  usePresenceActivity();

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
    const id = window.setTimeout(() => void loadPage(tab, 1, true), 0);
    return () => window.clearTimeout(id);
  }, [tab, loadPage]);

  async function reloadAfterAction(message: string) {
    setNote(message);
    setPage(1);
    await loadPage(tab, 1, true);
  }

  const counts = pageData?.counts ?? null;
  const hasMore = pageData ? items.length < pageData.total : false;

  return (
    <section className="up-glass up-panel" aria-labelledby="tkv-ads-title">
      <div className="tkv-card-head">
        <h1 id="tkv-ads-title" className="up-h2">My ads</h1>
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
                href: item.slug ? undefined : draftPath(item.id),
                actions: <OwnerActions id={item.id} title={ad.title} status={item.status} endsSoon={status.label === "Ending soon"} onDone={reloadAfterAction} />,
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
      <p className="up-muted"><Link href="/u/account/media/" className="up-link">Photos and videos</Link></p>
      <PostStrip text={t("post.strip.text")} button={t("post.strip.button")} feeText={t("post.strip.fee")} />
    </section>
  );
}
