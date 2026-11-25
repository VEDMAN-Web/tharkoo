"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/help/UiTextProvider";
import { api } from "@/lib/ui/api";

/** H21.1: "How this category looks": a small list of the real ads in the chosen category and city, grouped as the list shows them. */

export type PreviewHit = { slug: string; title: string; place?: string; photos?: string[]; variant: string };
type Tier = "super" | "top" | "all";

/** H21.12b: a preview shows at most this many other ads, whole, with no inner scroll. */
export const PREVIEW_OTHERS = 2;
const FETCH_SIZE = 12;
const MAX_CHIPS = 3;
const SUPER_VARIANTS = new Set(["star", "supertop"]);
const TOP_VARIANTS = new Set(["top", "flash", "highlight"]);

export function tierOf(variant: string): Tier {
  if (SUPER_VARIANTS.has(variant)) return "super";
  if (TOP_VARIANTS.has(variant)) return "top";
  return "all";
}

/** The other ads a preview shows: one boosted ad and one normal ad when both are there, else the first two there are. */
export function previewOthers(hits: PreviewHit[]): PreviewHit[] {
  const boosted = [...hits.filter((hit) => tierOf(hit.variant) === "super"), ...hits.filter((hit) => tierOf(hit.variant) === "top")];
  const normal = hits.filter((hit) => tierOf(hit.variant) === "all");
  const first = [...boosted.slice(0, 1), ...normal.slice(0, 1)];
  const rest = [...boosted.slice(1), ...normal.slice(1)];
  return [...first, ...rest].slice(0, PREVIEW_OTHERS);
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

function Card({ hit, tier }: { hit: PreviewHit; tier: Tier }) {
  const t = useT();
  const photo = hit.photos?.[0];
  return (
    <div className={`tkp-catpre-card${tier === "super" ? " wide" : ""}`}>
      <div className="tkp-catpre-photo" style={photo ? { backgroundImage: `url("${photo}")` } : undefined}>
        {tier === "super" ? <span className="tkp-catpre-tag super">{t("post.v2.cat.tierSuper")}</span> : null}
        {tier === "top" ? <span className="tkp-catpre-tag">{t("post.v2.cat.tierTop")}</span> : null}
      </div>
      <div className="tkp-catpre-body">
        <div className="tkp-catpre-line">{hit.title}</div>
        {hit.place ? <div className="tkp-catpre-place">{hit.place}</div> : null}
      </div>
    </div>
  );
}

export function CategoryPreview({ categoryName, cityName, chips, hits, loading, where }: Props) {
  const t = useT();
  const groups: Record<Tier, PreviewHit[]> = { super: [], top: [], all: [] };
  const others = previewOthers(hits);
  for (const hit of others) groups[tierOf(hit.variant)].push(hit);
  const fillers = Math.max(0, PREVIEW_OTHERS - others.length);
  const tiers: { tier: Tier; label: string }[] = [
    { tier: "super", label: t("post.v2.cat.tierSuper") },
    { tier: "top", label: t("post.v2.cat.tierTop") },
    { tier: "all", label: t("post.v2.cat.tierAll") },
  ];
  return (
    <section className={`tkp-catpre-${where}`} data-tk={`category-preview-${where}`} aria-label={t("post.v2.cat.previewTitle")} aria-busy={loading}>
      <p className="tkp-catpre-title">{t("post.v2.cat.previewTitle")}</p>
      <div className="tkp-catpre-frame">
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
        <div className="tkp-catpre-grid">
          {tiers.map(({ tier, label }) =>
            groups[tier].length || (tier === "all" && fillers > 0) ? (
              <div key={tier} style={{ display: "contents" }}>
                <div className="tkp-catpre-tier">{label}</div>
                {groups[tier].map((hit) => (
                  <Card key={hit.slug} hit={hit} tier={tier} />
                ))}
                {tier === "all" ? Array.from({ length: fillers }, (_, index) => <span key={`skel-${index}`} className="tkp-catpre-skel" aria-hidden="true" />) : null}
              </div>
            ) : null,
          )}
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
