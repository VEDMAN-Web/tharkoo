"use client";

import { Camera } from "lucide-react";
import { useT } from "@/components/help/UiTextProvider";
import { tierOf, type PreviewHit } from "./CategoryPreview";
import "./category-step.css";

/** H21.5a: "How it looks in the list": real ads of the category and city, with the person's own ad ("YOUR AD") where the chosen option puts it. */

export type ListKind = "free" | "top" | "super";
const MIN_CARDS = 4;

type Tier = "super" | "top" | "all";
type Props = {
  kind: ListKind;
  hours: number | null;
  categoryName: string;
  cityName: string;
  title: string;
  place: string;
  cover: string | null;
  hits: PreviewHit[];
  where: "inline" | "side";
};

function Real({ hit, tier }: { hit: PreviewHit; tier: Tier }) {
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

export function ReviewListPreview({ kind, hours, categoryName, cityName, title, place, cover, hits, where }: Props) {
  const t = useT();
  const tiers: Record<Tier, PreviewHit[]> = { super: [], top: [], all: [] };
  for (const hit of hits) tiers[tierOf(hit.variant)].push(hit);
  const mine = (tier: Tier) => (
    <div key="mine" className={`tkp-catpre-card is-mine${tier === "super" ? " wide" : ""}`} data-tk="list-mine">
      <div className="tkp-catpre-photo" style={cover ? { backgroundImage: `url("${cover}")` } : undefined}>
        {tier === "super" ? <span className="tkp-catpre-tag super">{t("post.v2.cat.tierSuper")}</span> : null}
        {tier === "top" ? <span className="tkp-catpre-tag">{t("post.v2.cat.tierTop")}</span> : null}
        <span className="tkp-catpre-tag mine">{t("post.v2.rev.yourTag")}</span>
        {cover ? null : <Camera size={26} aria-hidden="true" focusable="false" />}
      </div>
      <div className="tkp-catpre-body">
        <div className="tkp-catpre-line">{title}</div>
        {place ? <div className="tkp-catpre-place">{place}</div> : null}
      </div>
    </div>
  );
  const sections: { tier: Tier; label: string; cards: React.ReactNode[] }[] = [
    { tier: "super", label: t("post.v2.cat.tierSuper"), cards: [...(kind === "super" ? [mine("super")] : []), ...tiers.super.map((hit) => <Real key={hit.slug} hit={hit} tier="super" />)] },
    { tier: "top", label: t("post.v2.cat.tierTop"), cards: [...(kind === "top" ? [mine("top")] : []), ...tiers.top.map((hit) => <Real key={hit.slug} hit={hit} tier="top" />)] },
    { tier: "all", label: t("post.v2.cat.tierAll"), cards: [...(kind === "free" ? [mine("all")] : []), ...tiers.all.map((hit) => <Real key={hit.slug} hit={hit} tier="all" />)] },
  ];
  const shown = sections.reduce((sum, section) => sum + section.cards.length, 0);
  const fillers = Math.max(0, MIN_CARDS - shown);
  const caption = kind === "super" ? t("post.v2.rev.capSuper", { hours: hours ?? "" }) : kind === "top" ? t("post.v2.rev.capTop", { hours: hours ?? "" }) : t("post.v2.rev.capFree");
  return (
    <section className={`tkp-catpre-${where}`} data-tk={`review-list-${where}`} data-kind={kind} aria-label={t("post.v2.rev.listTitle")}>
      <p className="tkp-catpre-title">{t("post.v2.rev.listTitle")}</p>
      <div className="tkp-catpre-frame">
        <div className="tkp-catpre-head">
          <div className="tkp-catpre-top">
            <span>{t("post.v2.cat.previewLabel").toUpperCase()}</span>
            {cityName ? <span>{cityName}</span> : null}
          </div>
          <div className="tkp-catpre-name">{cityName ? `${categoryName} · ${cityName}` : categoryName}</div>
        </div>
        <div className="tkp-catpre-grid">
          {sections.map((section) =>
            section.cards.length || (section.tier === "all" && fillers > 0) ? (
              <div key={section.tier} style={{ display: "contents" }}>
                <div className="tkp-catpre-tier">{section.label}</div>
                {section.cards}
                {section.tier === "all" ? Array.from({ length: fillers }, (_, index) => <span key={`skel-${index}`} className="tkp-catpre-skel" aria-hidden="true" />) : null}
              </div>
            ) : null,
          )}
        </div>
      </div>
      <p className="tkp-catpre-caption" data-tk="list-caption">{caption}</p>
    </section>
  );
}
