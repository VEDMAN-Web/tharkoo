"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdCard } from "../ui/AdCard";
import { SectionHelp } from "@/components/help/SectionHelp";
import { loadAccountSaved, readSaved, type SavedItem } from "../ui/SaveButton";
import { displayTitle } from "@/lib/format";
import type { ListingDoc } from "@/lib/models";

/** H7.6: the saved ads panel. A visitor who is not signed in keeps saved ads on this device; a signed-in one sees the account's list. */
const SHOWN = 4;

export function SavedAdsRail() {
  const [items, setItems] = useState<SavedItem[] | null>(null);
  useEffect(() => {
    let live = true;
    const id = window.setTimeout(() => setItems(readSaved()), 0);
    // A signed-in visitor sees the account's list (H15.7), the same on every device.
    void loadAccountSaved().then((list) => {
      if (live && list) setItems(list);
    });
    const onChange = () => setItems(readSaved());
    window.addEventListener("tk-saved", onChange);
    return () => {
      live = false;
      window.clearTimeout(id);
      window.removeEventListener("tk-saved", onChange);
    };
  }, []);

  const count = items?.length ?? 0;
  return (
    <section aria-labelledby="saved-heading" className={`up-panel up-glass`}>
      <div className="up-panel-head">
        <h2 id="saved-heading" className="up-h2">Saved ads</h2>
        <SectionHelp textKey="help.section.saved" />
        {count > 0 ? <Link href="/u/account/saved/" className="up-link">See all {count}</Link> : null}
      </div>
      {items === null ? (
        <div className="up-cards-fill" aria-hidden="true">
          <div className="up-skeleton" />
        </div>
      ) : count === 0 ? (
        <div className="up-empty">
          <p className="up-empty-title">Nothing saved yet</p>
          <p className="up-empty-body">Tap the heart on an ad to keep it here.</p>
          <Link href="/" className="up-btn-ghost">Browse ads</Link>
        </div>
      ) : (
        <ul className="up-cards-fill" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.slice(0, SHOWN).map((item) => (
            <li key={item.id}>
              <AdCard ad={{ slug: item.slug, title: displayTitle(item.title), place: item.place, photos: item.photo ? [item.photo] : [], publicId: item.id } as ListingDoc} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
