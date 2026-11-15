"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdCard } from "../ui/AdCard";
import { SectionHelp } from "@/components/help/SectionHelp";
import { readSaved, type SavedItem } from "../ui/SaveButton";
import { displayTitle } from "@/lib/format";
import type { ListingDoc } from "@/lib/models";
import styles from "./UserPanel.module.css";

/** H7.6: the saved ads panel. Saved ads are kept on this device (the Save button), so the count is this device's. */
const SHOWN = 4;

export function SavedAdsRail() {
  const [items, setItems] = useState<SavedItem[] | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setItems(readSaved()), 0);
    return () => window.clearTimeout(id);
  }, []);

  const count = items?.length ?? 0;
  return (
    <section aria-labelledby="saved-heading" className={`${styles.panel} ${styles.glass}`}>
      <div className={styles.panelHead}>
        <h2 id="saved-heading" className={styles.h2}>Saved ads</h2>
        <SectionHelp textKey="help.section.saved" />
        {count > 0 ? <Link href="/u/account/saved/" className={styles.link}>See all {count}</Link> : null}
      </div>
      {items === null ? (
        <div className={styles.cardsWide} aria-hidden="true">
          <div className={styles.skeleton} />
        </div>
      ) : count === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Nothing saved yet</p>
          <p className={styles.emptyBody}>Tap the heart on an ad to keep it here.</p>
          <Link href="/" className={styles.ghost}>Browse ads</Link>
        </div>
      ) : (
        <ul className={styles.cardsWide} style={{ listStyle: "none", padding: 0, margin: 0 }}>
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
