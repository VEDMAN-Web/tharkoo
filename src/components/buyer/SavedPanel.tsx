"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdCard } from "../ui/AdCard";
import { readRecent } from "../ui/RecentlyViewed";
import { loadAccountSaved, readSaved, removeSaved, type SavedItem } from "../ui/SaveButton";
import { displayTitle } from "@/lib/format";
import type { ListingDoc } from "@/lib/models";
import type { PanelSummary } from "@/server/notifications/summary";
import { Heart } from "lucide-react";
import { EmptyIcon, UserPanelShell } from "./UserPanelShell";

/**
 * H7.17: saved ads and recently viewed ads on the user panel. A visitor who is not signed in keeps them on this device; once signed in
 * the saved list is the account's (H15.7), the same on every device, and Remove takes an ad off it.
 */

export function SavedPanel({ summary }: { summary: PanelSummary }) {
  const [saved, setSaved] = useState<SavedItem[] | null>(null);
  const [recent, setRecent] = useState<ListingDoc[]>([]);
  useEffect(() => {
    let live = true;
    const id = window.setTimeout(() => {
      setSaved(readSaved());
      setRecent(readRecent());
    }, 0);
    void loadAccountSaved().then((list) => {
      if (live && list) setSaved(list);
    });
    const onChange = () => setSaved(readSaved());
    window.addEventListener("tk-saved", onChange);
    return () => {
      live = false;
      window.clearTimeout(id);
      window.removeEventListener("tk-saved", onChange);
    };
  }, []);

  return (
    <UserPanelShell active="saved" summary={summary}>
      <section aria-labelledby="saved-heading" className="up-glass up-panel">
        <div className="up-panel-head">
          <h1 id="saved-heading" className="up-h2">Saved ads</h1>
          {saved && saved.length > 0 ? <p className="up-muted">{saved.length} {summary.signedIn ? "saved in your account" : "saved on this device"}</p> : null}
        </div>
        {saved === null ? (
          <div className="up-skeleton" aria-hidden="true" />
        ) : saved.length === 0 ? (
          <div className="up-empty">
            <EmptyIcon icon={Heart} />
            <p className="up-empty-title">Nothing saved yet</p>
            <p className="up-empty-body">Tap the heart on an ad to keep it here.</p>
            <Link href="/" className="up-btn">Browse ads</Link>
          </div>
        ) : (
          <ul className="up-cards">
            {saved.map((item) => (
              <li key={item.id} className="up-saved-item">
                <AdCard ad={{ slug: item.slug, title: displayTitle(item.title), place: item.place, photos: item.photo ? [item.photo] : [], publicId: item.id } as ListingDoc} />
                <button type="button" className="up-btn-ghost up-saved-remove" data-tk="saved-remove" aria-label={`Remove saved ad ${displayTitle(item.title)}`} onClick={() => void removeSaved(item)}>
                  Remove
                </button>
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
