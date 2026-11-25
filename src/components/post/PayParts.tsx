"use client";

import { useT } from "@/components/help/UiTextProvider";
import { creditsText, rupeesText } from "./credits";

type PayProps = {
  fee: number;
  price?: number;
  balance: number | null;
  short: number;
  onRecharge: () => void;
  /** H11.1b: this ad is one of the account's free ads: "free ad 2 of 3". */
  freeAd?: { adNumber: number; freeAds: number } | null;
};

export function PayCard({ fee, price, balance, short, onRecharge, freeAd = null }: PayProps) {
  const t = useT();
  const low = short > 0;
  if (freeAd) {
    return (
      <section className="tkp-pay is-free" data-tk="pay-card" data-state="free" aria-label={t("post.pay.titleFree")}>
        <h2 className="tkp-pay-title">{t("post.pay.titleFree")}</h2>
        <p className="tkp-pay-headline is-free" data-tk="pay-headline">{t("post.pay.free", { number: freeAd.adNumber, total: freeAd.freeAds })}</p>
        <dl className="tkp-pay-rows">
          <div><dt>{t("post.pay.yourBalance")}</dt><dd data-tk="pay-balance">{balance === null ? "..." : creditsText(balance)}</dd></div>
        </dl>
      </section>
    );
  }
  return (
    <section className={`tkp-pay ${low ? "is-low" : ""}`} data-tk="pay-card" data-state={low ? "low" : "ok"} aria-label={t("post.pay.title")}>
      <h2 className="tkp-pay-title">{t("post.pay.title")}</h2>
      <p className="tkp-pay-headline" data-tk="pay-headline">{t("post.pay.costs", { rupees: rupeesText(fee, price), credits: creditsText(fee) })}</p>
      <dl className="tkp-pay-rows">
        <div><dt>{t("post.pay.fee")}</dt><dd data-tk="pay-fee">{creditsText(fee)}</dd></div>
        <div><dt>{t("post.pay.yourBalance")}</dt><dd data-tk="pay-balance">{balance === null ? "..." : creditsText(balance)}</dd></div>
        {low ? null : <div><dt>{t("post.pay.after")}</dt><dd data-tk="pay-after">{creditsText((balance ?? 0) - fee)}</dd></div>}
      </dl>
      {low ? (
        <p className="tkp-pay-note" role="alert" id="pay-reason" data-tk="pay-short">
          {short === 1 ? t("post.pay.shortOne") : t("post.pay.short", { short })}{" "}
          <button type="button" className="tkp-credits-link" onClick={onRecharge}>{t("post.nav.recharge")}</button>
        </p>
      ) : null}
    </section>
  );
}
