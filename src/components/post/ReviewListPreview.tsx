"use client";

import { useT } from "@/components/help/UiTextProvider";
import { PreviewCard, PreviewHead, PreviewPlaceholder, previewSlots, type PreviewHit, type Tier } from "./CategoryPreview";
import "./category-step.css";

/** H21.5a: "How it looks in the list": real ads of the category and city, with the person's own ad ("YOUR AD") where the chosen option puts it. */

export type ListKind = "free" | "top" | "super";

/** The other cards in each row for each choice, as on the Review boards; the person's own card takes its place in the chosen row. */
const REVIEW_SLOTS: Record<ListKind, Record<Tier, number>> = {
  super: { super: 0, top: 2, all: 2 },
  top: { super: 1, top: 1, all: 2 },
  free: { super: 1, top: 2, all: 3 },
};
type Props = {
  kind: ListKind;
  hours: number | null;
  categoryName: string;
  cityName: string;
  title: string;
  place: string;
  cover: string | null;
  chips: string[];
  hits: PreviewHit[];
  where: "inline" | "side";
};

export function ReviewListPreview({ kind, hours, categoryName, cityName, title, place, cover, chips, hits, where }: Props) {
  const t = useT();
  const slots = previewSlots(hits, REVIEW_SLOTS[kind]);
  const mine = (tier: Tier) => (
    <div key="mine" className={`tkp-catpre-card is-mine${tier === "super" ? " wide" : ""}`} data-tk="list-mine">
      <div className="tkp-catpre-photo" style={cover ? { backgroundImage: `url("${cover}")` } : undefined}>
        {tier === "super" ? <span className="tkp-catpre-tag super">{t("post.v2.cat.tierSuper")}</span> : null}
        {tier === "top" ? <span className="tkp-catpre-tag">{t("post.v2.cat.tierTop")}</span> : null}
        <span className="tkp-catpre-tag mine">{t("post.v2.rev.yourTag")}</span>
      </div>
      <div className="tkp-catpre-body">
        <div className="tkp-catpre-line">{title}</div>
        {place ? <div className="tkp-catpre-place">{place}</div> : null}
      </div>
    </div>
  );
  const others = (tier: Tier) => slots[tier].map((hit, index) => (hit ? <PreviewCard key={hit.slug} hit={hit} tier={tier} /> : <PreviewPlaceholder key={`ph-${index}`} tier={tier} />));
  // Super Top and TOP: the person's card is first in its row. Free: it comes after the other ads, below every boosted ad.
  const sections: { tier: Tier; label: string; cards: React.ReactNode[] }[] = [
    { tier: "super", label: t("post.v2.cat.tierSuper"), cards: [...(kind === "super" ? [mine("super")] : []), ...others("super")] },
    { tier: "top", label: t("post.v2.cat.tierTop"), cards: [...(kind === "top" ? [mine("top")] : []), ...others("top")] },
    { tier: "all", label: t("post.v2.cat.tierAll"), cards: [...others("all"), ...(kind === "free" ? [mine("all")] : [])] },
  ];
  const caption = kind === "super" ? t("post.v2.rev.capSuper", { hours: hours ?? "" }) : kind === "top" ? t("post.v2.rev.capTop", { hours: hours ?? "" }) : t("post.v2.rev.capFree");
  return (
    <section className={`tkp-catpre-${where}`} data-tk={`review-list-${where}`} data-kind={kind} aria-label={t("post.v2.rev.listTitle")}>
      <p className="tkp-catpre-title">{t("post.v2.rev.listTitle")}</p>
      <div className="tkp-catpre-frame">
        <PreviewHead categoryName={categoryName} cityName={cityName} chips={chips} />
        <div className="tkp-catpre-grid">
          {sections.map((section) => (
            <div key={section.tier} className="tkp-catpre-row" data-tier={section.tier}>
              <div className="tkp-catpre-tier">{section.label}</div>
              {section.cards}
            </div>
          ))}
        </div>
      </div>
      <p className="tkp-catpre-caption" data-tk="list-caption">{caption}</p>
    </section>
  );
}
