"use client";

import { BadgeCheck } from "lucide-react";
import { useContact } from "@/components/ContactButtons";
import { useT } from "@/components/ui/AdCard";

export function AdSellerRow({ name, verified = false, since = "" }: { name: string; verified?: boolean; since?: string }) {
  const t = useT();
  const { seller } = useContact();
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const live = seller?.chatOn ? seller.status : null;
  return (
    <div className="tkn-seller-row" data-tk="seller-row">
      <span className="tkn-seller-avatar" aria-hidden>{initial}</span>
      <span className="tkn-seller-text">
        <strong>{name}</strong>
        {verified || live ? (
          <span className="tkn-seller-line">
            {verified ? (
              <span className="tkn-seller-verified">
                <BadgeCheck size={14} aria-hidden />
                {t("ad.seller.verified")}
              </span>
            ) : null}
            {live ? (
              <span className="tkn-seller-status" data-tk="availability" data-status={live}>
                <span className="tkn-dot" data-status={live} aria-hidden />
                {live === "online" ? t("ad.seller.onlineShort") : t("ad.seller.awayShort")}
              </span>
            ) : null}
          </span>
        ) : null}
        {since ? <span className="tkn-seller-since">{t("ad.seller.since", { date: since })}</span> : null}
      </span>
    </div>
  );
}
