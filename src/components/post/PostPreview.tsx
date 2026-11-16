"use client";

import { X } from "lucide-react";
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

export function previewAd(input: PreviewInput): ListingDoc {
  return {
    slug: "",
    publicId: "preview",
    title: input.title || "Your ad title",
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
  const ref = useFocusTrap<HTMLDivElement>(true, onClose);
  return (
    <div className="tkp-sheet-back" onClick={onClose}>
      <div ref={ref} className="tkp-sheet" role="dialog" aria-modal="true" aria-label="Preview of your ad" data-tk="preview-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="tkp-sheet-head">
          <h2>Live preview</h2>
          <button type="button" className="tkn-icon-btn" aria-label="Close preview" onClick={onClose}>
            <X size={20} aria-hidden="true" focusable="false" />
          </button>
        </div>
        <PostPreviewCard ad={ad} label="Live preview" hasPhoto={hasPhoto} byline={byline} />
        <p className="tkp-preview-line" style={{ marginTop: 12 }}>This is how your ad will look.</p>
      </div>
    </div>
  );
}
