"use client";

import { useT } from "@/components/help/UiTextProvider";
import { creditsText, rupeesText } from "./credits";

type CardProps = { fee: number; price?: number; balance: number | null; ready: boolean; onTopUp: () => void };

export function CreditsCard({ fee, price, balance, ready, onTopUp }: CardProps) {
  const t = useT();
  if (ready && balance === null) {
    return (
      <div className="tkp-credits" data-tk="credits-card">
        <p className="tkp-credits-line">{t("post.pay.cost", { credits: creditsText(fee), rupees: rupeesText(fee, price) })}</p>
      </div>
    );
  }
  return (
    <div className="tkp-credits" data-tk="credits-card">
      <p className="tkp-credits-title">{t("post.pay.creditsTitle")}</p>
      <p className="tkp-credits-line" data-tk="credits-balance">{t("post.pay.balance", { balance: balance === null ? "..." : creditsText(balance) })}</p>
      <p className="tkp-credits-line">{fee > 0 ? t("post.pay.thisAd", { credits: creditsText(fee) }) : t("post.pay.noCharge")}</p>
      {fee > 0 ? <button type="button" className="tkp-credits-link" data-tk="credits-topup" onClick={onTopUp}>{t("post.pay.topUp")}</button> : null}
    </div>
  );
}

type PayProps = { fee: number; balance: number | null; short: number; onRecharge: () => void };

export function PayCard({ fee, balance, short, onRecharge }: PayProps) {
  const t = useT();
  const low = short > 0;
  return (
    <section className={`tkp-pay ${low ? "is-low" : ""}`} data-tk="pay-card" data-state={low ? "low" : "ok"} aria-label={t("post.pay.title")}>
      <h2 className="tkp-pay-title">{t("post.pay.title")}</h2>
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
