"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/help/UiTextProvider";
import { api } from "@/lib/ui/api";

/** H21.1: "How this category looks": a small list of the real ads in the chosen category and city, grouped as the list shows them. */

export type PreviewHit = { slug: string; title: string; place?: string; photos?: string[]; variant: string };
export type Tier = "super" | "top" | "all";

/** H21.12b: how many cards each row of the preview holds, as on the design boards. */
export const CATEGORY_SLOTS: Record<Tier, number> = { super: 1, top: 2, all: 3 };
const FETCH_SIZE = 24;
const MAX_CHIPS = 3;
const SUPER_VARIANTS = new Set(["star", "supertop"]);
const TOP_VARIANTS = new Set(["top", "flash", "highlight"]);

export function tierOf(variant: string): Tier {
  if (SUPER_VARIANTS.has(variant)) return "super";
  if (TOP_VARIANTS.has(variant)) return "top";
  return "all";
}

/** Fills each row with the real ads of that tier, and `null` (a plain placeholder) where there is none: an ad is never moved up into a boosted row. */
export function previewSlots(hits: PreviewHit[], counts: Record<Tier, number>): Record<Tier, (PreviewHit | null)[]> {
  const row = (tier: Tier) => {
    const real = hits.filter((hit) => tierOf(hit.variant) === tier);
    return Array.from({ length: counts[tier] }, (_, index) => real[index] ?? null);
  };
  return { super: row("super"), top: row("top"), all: row("all") };
}

/** Loads the real ads of a category (and city when one is chosen). Stale answers are dropped. */
export function useCategoryPreview(categorySlug: string, citySlug: string) {
  const [state, setState] = useState<{ key: string; hits: PreviewHit[] } | null>(null);
  const key = `${categorySlug}|${citySlug}`;
  useEffect(() => {
    if (!categorySlug) return;
    let live = true;
    const query = new URLSearchParams({ category: categorySlug, pageSize: String(FETCH_SIZE) });
    if (citySlug) query.set("city", citySlug);
    void api<{ hits?: PreviewHit[] }>(`/api/search?${query.toString()}`).then((res) => {
      if (live) setState({ key, hits: res.ok ? (res.data.hits ?? []) : [] });
    });
    return () => {
      live = false;
    };
  }, [categorySlug, citySlug, key]);
  return { loading: Boolean(categorySlug) && state?.key !== key, hits: state?.key === key ? state.hits : [] };
}

type Props = {
  categoryName: string;
  cityName: string;
  chips: string[];
  hits: PreviewHit[];
  loading: boolean;
  /** "inline" sits under the tiles on a phone; "side" is the computer side column. */
  where: "inline" | "side";
};

function Heart() {
  return (
    <span className="tkp-catpre-heart" aria-hidden="true">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#b0106a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" /></svg>
    </span>
  );
}

export function PreviewCard({ hit, tier }: { hit: PreviewHit; tier: Tier }) {
  const t = useT();
  const photo = hit.photos?.[0];
  return (
    <div className={`tkp-catpre-card${tier === "super" ? " wide" : ""}`}>
      <div className="tkp-catpre-photo" style={photo ? { backgroundImage: `url("${photo}")` } : undefined}>
        {tier === "super" ? <span className="tkp-catpre-tag super">{t("post.v2.cat.tierSuper")}</span> : null}
        {tier === "top" ? <span className="tkp-catpre-tag">{t("post.v2.cat.tierTop")}</span> : null}
        <Heart />
      </div>
      <div className="tkp-catpre-body">
        <div className="tkp-catpre-line">{hit.title}</div>
        {hit.place ? <div className="tkp-catpre-place">{hit.place}</div> : null}
      </div>
    </div>
  );
}

/** A soft gradient card with no words: stands where there is no real ad (it pulses while the ads are loading). */
export function PreviewPlaceholder({ tier, loading }: { tier: Tier; loading?: boolean }) {
  return (
    <div className={`tkp-catpre-card tkp-catpre-ph${tier === "super" ? " wide" : ""}${loading ? " is-loading" : ""}`} aria-hidden="true">
      <div className="tkp-catpre-photo" />
      <div className="tkp-catpre-body">
        <span className="tkp-catpre-bar" />
        <span className="tkp-catpre-bar short" />
      </div>
    </div>
  );
}

/** The head of the preview: category and city, with the "All" chip and up to three real filter words. */
export function PreviewHead({ categoryName, cityName, chips }: { categoryName: string; cityName: string; chips: string[] }) {
  const t = useT();
  return (
    <div className="tkp-catpre-head">
      <div className="tkp-catpre-top">
        <span>{t("post.v2.cat.previewLabel").toUpperCase()}</span>
        {cityName ? <span>{cityName}</span> : null}
      </div>
      <div className="tkp-catpre-name">{cityName ? `${categoryName} · ${cityName}` : categoryName}</div>
      <div className="tkp-catpre-chips" aria-hidden="true">
        <span className="tkp-catpre-chip on">{t("post.v2.cat.chipAll")}</span>
        {chips.slice(0, MAX_CHIPS).map((chip) => (
          <span key={chip} className="tkp-catpre-chip">{chip}</span>
        ))}
      </div>
    </div>
  );
}

export function CategoryPreview({ categoryName, cityName, chips, hits, loading, where }: Props) {
  const t = useT();
  const slots = previewSlots(hits, CATEGORY_SLOTS);
  const tiers: { tier: Tier; label: string }[] = [
    { tier: "super", label: t("post.v2.cat.tierSuper") },
    { tier: "top", label: t("post.v2.cat.tierTop") },
    { tier: "all", label: t("post.v2.cat.tierAll") },
  ];
  return (
    <section className={`tkp-catpre-${where}`} data-tk={`category-preview-${where}`} aria-label={t("post.v2.cat.previewTitle")} aria-busy={loading}>
      <p className="tkp-catpre-title">{t("post.v2.cat.previewTitle")}</p>
      <div className="tkp-catpre-frame">
        <PreviewHead categoryName={categoryName} cityName={cityName} chips={chips} />
        <div className="tkp-catpre-grid">
          {tiers.map(({ tier, label }) => (
            <div key={tier} className="tkp-catpre-row" data-tier={tier}>
              <div className="tkp-catpre-tier">{label}</div>
              {slots[tier].map((hit, index) => (hit ? <PreviewCard key={hit.slug} hit={hit} tier={tier} /> : <PreviewPlaceholder key={`ph-${index}`} tier={tier} loading={loading} />))}
            </div>
          ))}
        </div>
      </div>
      <p className="tkp-catpre-caption">
        {categoryName ? t("post.v2.cat.previewCaption", { category: categoryName }) : t("post.v2.cat.previewCaptionPlain")}
      </p>
    </section>
  );
}

/** Shown in place of the preview until a category is picked. */
export function CategoryPreviewHint({ where }: { where: "inline" | "side" }) {
  const t = useT();
  return (
    <section className={`tkp-catpre-${where}`} data-tk={`category-preview-${where}`}>
      <p className="tkp-catpre-title">{t("post.v2.cat.previewTitle")}</p>
      <p className="tkp-catpre-empty">{t("post.v2.cat.pickFirst")}</p>
    </section>
  );
}
