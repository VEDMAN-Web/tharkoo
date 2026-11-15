"use client";

import { viewsLabel } from "@/components/ad/counts-format";
import { useShownCounts } from "@/components/ad/adCountStore";
import { useContact } from "@/components/ContactButtons";
import { useT } from "@/components/ui/AdCard";

export function AdSellerRow({ name }: { name: string }) {
  const t = useT();
  const { seller } = useContact();
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="tkn-seller-row">
      <span className="tkn-seller-avatar" aria-hidden>{initial}</span>
      <span className="tkn-seller-text">
        <strong>{name}</strong>
        {seller?.chatOn ? (
          <span className="tkn-seller-status" data-status={seller.status}>
            {seller.status === "online" ? t("ad.seller.online") : t("ad.seller.away")}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function AdMetaLine({ slug, place, posted }: { slug: string; place: string; posted: string }) {
  const t = useT();
  const counts = useShownCounts(slug);
  return (
    <p className="tkn-ad-meta">
      {t("ad.meta.line", { place, date: posted, views: `${counts?.views ?? 0} ${viewsLabel(counts?.views ?? 0)}`, clicks: counts?.clicks ?? 0 })}
    </p>
  );
}
