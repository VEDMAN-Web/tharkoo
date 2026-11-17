"use client";

import { Tag } from "lucide-react";
import { Notice, PageHeader, ToastProvider } from "@/components/admin/ui";
import type { CouponRow } from "@/server/billing/coupons-admin";
import type { PackRow } from "@/server/billing/packs-admin";
import type { PricesData } from "@/server/billing/plans-admin";
import { CouponsCard } from "../_coupons/CouponsCard";
import { PacksCard } from "../_packs/PacksCard";
import { MoneyCard } from "./MoneyCard";
import { PlansCard } from "./PlansCard";
import "./prices.css";

/** Prices & plans, part 1 (H8.17). Packs and coupons (A20) sit below the plans. */
export function PricesView({ data, packs, coupons, canEdit }: { data: PricesData; packs: PackRow[]; coupons: CouponRow[]; canEdit: boolean }) {
  const { money, plans, freeCodes, testCredits } = data;
  return (
    <ToastProvider>
      <div className="adm-k" data-tk="prices-screen">
        <PageHeader
          crumbs={[{ label: "Money" }]}
          title="Prices & plans"
          purpose={canEdit ? "Posting fee, credit price, test payments and promotion plans. Only admins can change them." : "Posting fee, credit price, test payments and promotion plans. You can look; only admins can change them."}
          more={[{ key: "orders", label: "Promotion orders", icon: Tag, href: "/admin/promotions/" }]}
          secondary={[{ key: "coupons", label: `Coupons (${coupons.length})`, icon: Tag, href: "#coupons" }]}
        />
        {money.mockPaymentsOn ? (
          <Notice kind="error" title="Test payments are ON.">
            {" "}Anyone can add credits without paying.{" "}
            {testCredits.credits > 0
              ? `${testCredits.credits.toLocaleString("en-IN")} credits were added through test payments to ${testCredits.wallets.toLocaleString("en-IN")} ${testCredits.wallets === 1 ? "wallet" : "wallets"}. `
              : "No credits have been added through test payments yet. "}
            Turn this off before launch, after a real card or crypto gateway is connected.
          </Notice>
        ) : null}
        <MoneyCard initial={money} canEdit={canEdit} />
        <PlansCard plans={plans} freeCodes={freeCodes} creditPriceInr={money.creditPriceInr} canEdit={canEdit} />
        <PacksCard packs={packs} canEdit={canEdit} />
        <CouponsCard coupons={coupons} canEdit={canEdit} />
      </div>
    </ToastProvider>
  );
}
