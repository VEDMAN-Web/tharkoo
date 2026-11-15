"use client";

import { useShownCounts } from "@/components/ad/adCountStore";
import { useContact } from "@/components/ContactButtons";
import { useT } from "@/components/ui/AdCard";

/** H7.9: the seller row on the ad page contact panel: avatar, name, and the Online now or Away line. */
export function AdSellerRow({ name }: { name: string }) {
  const t = useT();
  const { seller } = useContact();
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="tkn-seller-row">
      <span className="tkn-seller-avatar" aria-hidden>{initial}</span>
      <span className="tkn-seller-text">
        <strong>{name}</strong>
        {seller ? (
          <span className="tkn-seller-status" data-status={seller.status}>
            {seller.status === "online" ? t("ad.seller.online") : t("ad.seller.away")}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** H7.9: "place · posted date · N views · N clicks" under the ad title. The counts are the ad's own (H6.17). */
export function AdMetaLine({ slug, place, posted }: { slug: string; place: string; posted: string }) {
  const t = useT();
  const counts = useShownCounts(slug);
  return (
    <p className="tkn-ad-meta">
      {t("ad.meta.line", { place, date: posted, views: counts?.views ?? 0, clicks: counts?.clicks ?? 0 })}
    </p>
  );
}
