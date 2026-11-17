"use client";

import { X } from "lucide-react";
import { useT } from "@/components/help/UiTextProvider";
import type { TextFn } from "@/lib/ui/text";
import { AdCard } from "@/components/ui/AdCard";
import { useFocusTrap } from "@/components/ui/useFocusTrap";
import type { ListingDoc } from "@/lib/models";
import "@/components/new/listing-spec.css";

export type PreviewInput = {
  title: string;
  description: string;
  categorySlug: string;
  citySlug: string;
  districtName: string;
  price: number | null;
  cover: string | null;
};

export function previewAd(input: PreviewInput, t: TextFn): ListingDoc {
  return {
    slug: "",
    publicId: "preview",
    title: input.title || t("post.previewCard.titleFallback"),
    description: input.description,
    categorySlug: input.categorySlug,
    citySlug: input.citySlug,
    place: input.districtName,
    price: input.price,
    photos: input.cover ? [input.cover] : [],
    variant: "free",
  } as ListingDoc;
}

export function PostPreviewCard({ ad, label, hasPhoto, byline }: { ad: ListingDoc; label: string; hasPhoto: boolean; byline?: string }) {
  return (
    <section aria-label={label} className="tkn-ls tkp-previewbox" data-tk="post-preview" data-photo={hasPhoto ? "yes" : "none"}>
      <div inert>
        <AdCard ad={ad} layout="row" byline={byline} />
      </div>
    </section>
  );
}

export function PreviewSheet({ ad, hasPhoto, byline, onClose }: { ad: ListingDoc; hasPhoto: boolean; byline?: string; onClose: () => void }) {
  const t = useT();
  const ref = useFocusTrap<HTMLDivElement>(true, onClose);
  return (
    <div className="tkp-sheet-back" onClick={onClose}>
      <div ref={ref} className="tkp-sheet" role="dialog" aria-modal="true" aria-label={t("post.previewCard.dialog")} data-tk="preview-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="tkp-sheet-head">
          <h2>{t("post.previewCard.heading")}</h2>
          <button type="button" className="tkn-icon-btn" aria-label={t("post.previewCard.close")} onClick={onClose}>
            <X size={20} aria-hidden="true" focusable="false" />
          </button>
        </div>
        <PostPreviewCard ad={ad} label={t("post.previewCard.heading")} hasPhoto={hasPhoto} byline={byline} />
        <p className="tkp-preview-line" style={{ marginTop: 12 }}>{t("post.previewCard.line")}</p>
      </div>
    </div>
  );
}
