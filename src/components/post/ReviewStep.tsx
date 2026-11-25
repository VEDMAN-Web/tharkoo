import Link from "next/link";
import { Camera } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/components/help/UiTextProvider";
import "./review-step.css";

export type ReviewRow = { key: string; label: string; value: string; step: number };

import type { CostBox } from "./money-text";

type Props = {
  /** "How should your ad show?" */
  options: ReactNode;
  video: ReactNode;
  /** On a phone these two come before the summary; on a computer they are in the side column. */
  listInline: ReactNode;
  earnInline: ReactNode;
  thumb: string | null;
  title: string;
  place: string;
  rows: ReviewRow[];
  cost: CostBox;
  /** Shown under the video calls row when the ad-credit balance is too low for the total. */
  low?: { title: string; body: string; onBuy: () => void } | null;
  note: string;
  terms: boolean;
  /** The 18+ tick is asked only until the account has accepted it once. */
  showAdult: boolean;
  adult: boolean;
  termsError?: string;
  adultError?: string;
  onEdit: (step: number) => void;
  onTerms: () => void;
  onAdult: () => void;
};

/**
 * H21.5a: Step 5, Review and publish. Order (the design boards): the options, the video calls row, the low-credits note when the balance is
 * too low, (phone: the list preview and the earnings), "Your ad" with an Edit link per part, the one cost box right above the ticks.
 */
export function ReviewStep(props: Props) {
  const t = useT();
  const { rows, cost } = props;
  return (
    <div className="tkr" data-tk="review-step">
      <div className="tkr-options" data-tk="review-options">{props.options}</div>
      <div className="tkr-video">{props.video}</div>
      {props.low ? (
        <div className="tkr-low" role="alert" data-tk="boost-short">
          <p><b>{props.low.title}</b> {props.low.body}</p>
          <button type="button" className="tkr-low-buy" data-tk="boost-buy" onClick={props.low.onBuy}>{t("post.v2.rev.buy")}</button>
        </div>
      ) : null}
      <div className="tkr-phone-only" data-tk="review-phone-extras">
        {props.listInline}
        {props.earnInline}
      </div>
      <section className="tkr-sum" data-tk="review-summary" aria-label={t("post.v2.rev.yourAd")}>
        <p className="tkr-sec">{t("post.v2.rev.yourAd")}</p>
        <div className="tkr-sum-card">
          <div className="tkr-sum-head" data-tk="review-preview">
            <span className={props.thumb ? "tkr-thumb" : "tkr-thumb is-empty"} data-tk="review-thumb" aria-hidden="true">
              {props.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <><img className="tkr-thumb-blur" src={props.thumb} alt="" /><img className="tkr-thumb-fit" src={props.thumb} alt="" /></>
              ) : (
                <Camera size={22} aria-hidden="true" focusable="false" />
              )}
            </span>
            <span className="tkr-sum-text">
              <b>{props.title}</b>
              <span>{props.place}</span>
            </span>
          </div>
          {rows.map((row) => (
            <div key={row.key} className="tkr-row" data-tk={`review-${row.key}`}>
              <span className="tkr-row-k">{row.label}</span>
              <span className="tkr-row-v">{row.value}</span>
              <button type="button" className="tkr-edit" data-tk={`edit-${row.key}`} aria-label={t("post.v2.rev.editAria", { label: row.label.toLowerCase() })} onClick={() => props.onEdit(row.step)}>
                {t("post.v2.rev.edit")}
              </button>
            </div>
          ))}
        </div>
      </section>
      {props.note ? <p className="tkp-note" data-tk="review-note">{props.note}</p> : null}
      <section className="tkr-cost" data-tk="review-cost" aria-label={t("post.v2.rev.costTotal")}>
        <div><span>{t("post.v2.rev.costPosting")}</span><span data-tk="cost-posting">{cost.posting}{cost.postingNote ? <small> {cost.postingNote}</small> : null}</span></div>
        <div><span>{t("post.v2.rev.costBoost")}</span><span data-tk="cost-boost">{cost.boost}</span></div>
        <div className="tkr-total"><span>{t("post.v2.rev.costTotal")}</span><span data-tk="cost-total">{cost.total}</span></div>
      </section>
      <div className="tkr-ticks">
        <div className={`tkp-consent ${props.termsError ? "is-bad" : ""}`}>
          <input id="consent-terms" type="checkbox" className="tk-check" checked={props.terms} onChange={props.onTerms} aria-invalid={Boolean(props.termsError)} />
          <label htmlFor="consent-terms">
            {t("post.v2.rev.agree")} <Link href="/terms/" target="_blank" rel="noopener">{t("post.reviewStep.terms")}</Link> {t("post.v2.rev.agreeAnd")}{" "}
            <Link href="/privacy/" target="_blank" rel="noopener">{t("post.reviewStep.privacy")}</Link>.
          </label>
          {props.termsError ? <span className="tk-error" data-tk="field-error">{props.termsError}</span> : null}
        </div>
        {props.showAdult ? (
          <div className={`tkp-consent ${props.adultError ? "is-bad" : ""}`}>
            <input id="consent-adult" type="checkbox" className="tk-check" checked={props.adult} onChange={props.onAdult} aria-invalid={Boolean(props.adultError)} />
            <label htmlFor="consent-adult">{t("post.v2.rev.adult")}</label>
            {props.adultError ? <span className="tk-error" data-tk="field-error">{props.adultError}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
