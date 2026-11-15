"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdCard } from "../ui/AdCard";
import { readRecent } from "../ui/RecentlyViewed";
import { readSaved, type SavedItem } from "../ui/SaveButton";
import { displayTitle } from "@/lib/format";
import type { ListingDoc } from "@/lib/models";
import type { PanelSummary } from "@/server/notifications/summary";
import { UserPanelShell } from "./UserPanelShell";

/** H7.17: saved ads and recently viewed ads on the user panel. Both live on this device, so no login is needed. */

export function SavedPanel({ summary }: { summary: PanelSummary }) {
  const [saved, setSaved] = useState<SavedItem[] | null>(null);
  const [recent, setRecent] = useState<ListingDoc[]>([]);
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSaved(readSaved());
      setRecent(readRecent());
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <UserPanelShell active="saved" summary={summary}>
      <section aria-labelledby="saved-heading" className="up-glass up-panel">
        <div className="up-panel-head">
          <h1 id="saved-heading" className="up-h2">Saved ads</h1>
          {saved && saved.length > 0 ? <p className="up-muted">{saved.length} saved on this device</p> : null}
        </div>
        {saved === null ? (
          <div className="up-skeleton" aria-hidden="true" />
        ) : saved.length === 0 ? (
          <div className="up-empty">
            <div className="up-empty-box" aria-hidden="true" />
            <p className="up-empty-title">Nothing saved yet</p>
            <p className="up-empty-body">Tap the heart on an ad to keep it here.</p>
            <Link href="/" className="up-btn">Browse ads</Link>
          </div>
        ) : (
          <ul className="up-cards">
            {saved.map((item) => (
              <li key={item.id}>
                <AdCard ad={{ slug: item.slug, title: displayTitle(item.title), place: item.place, photos: item.photo ? [item.photo] : [], publicId: item.id } as ListingDoc} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {recent.length > 0 ? (
        <section aria-labelledby="recent-heading" className="up-glass up-panel">
          <div className="up-panel-head">
            <h2 id="recent-heading" className="up-h2">Recently viewed</h2>
          </div>
          <ul className="up-cards">
            {recent.map((ad) => (
              <li key={ad.slug}>
                <AdCard ad={ad} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </UserPanelShell>
  );
}
