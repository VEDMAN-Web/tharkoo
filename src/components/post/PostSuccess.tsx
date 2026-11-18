import Link from "next/link";
import { CircleCheck, Clock } from "lucide-react";
import type { ListingDoc } from "@/lib/models";
import { useT } from "@/components/help/UiTextProvider";
import type { TextFn } from "@/lib/ui/text";
import { openSupportWith } from "@/components/recharge/openRecharge";
import { creditsText } from "./credits";
import type { SuccessCopy } from "./newCopy";
import { PostPreviewCard } from "./PostPreview";

export type UpsellPlan = { id: string; name: string; amount?: number };

type Props = {
  copy: SuccessCopy;
  live: boolean;
  where: string;
  ad: ListingDoc;
  hasPhoto: boolean;
  byline: string;
  anotherHref: string;
  adHref: string;
  receipt: string;
  plans: UpsellPlan[];
  planNote: string;
  onPlan: (plan: UpsellPlan) => void;
  /** H7.118: an edit of a posted ad was saved. No fee, no upsell. */
  saved?: boolean;
  paused?: boolean;
};

function nextSteps(t: TextFn, live: boolean, where: string, saved = false, paused = false): string[] {
  if (saved) {
    return [
      paused ? t("post.success.stillPaused") : t("post.success.changesLive"),
      t("post.success.seeViews"),
      t("post.success.pauseRenew"),
    ];
  }
  if (live) {
    return [
      where ? t("post.success.foundOn", { where }) : t("post.success.foundOnSite"),
      t("post.success.seeViews"),
      t("post.success.editPauseRenew"),
    ];
  }
  return [t("post.success.weCheck"), t("post.success.seeResult"), t("post.success.canEdit")];
}

export function PostSuccess({ copy, live, where, ad, hasPhoto, byline, anotherHref, adHref, receipt, plans, planNote, onPlan, saved = false, paused = false }: Props) {
  const t = useT();
  const Mark = live ? CircleCheck : Clock;
  // H14.2: once the ad is live the whole posted-ad card opens it (no View ad or View my ads button).
  const cardHref = adHref && live && !paused ? adHref : "";
  return (
    <div className="tkp-post" data-design="post-new" data-tk="post-success" data-state={saved ? "saved" : live ? "live" : "review"}>
      <div className="tkp-progress" aria-hidden><i style={{ width: "100%" }} /></div>
      <section className="tkp-success" aria-labelledby="post-success-title">
        <span className="tkp-success-mark" aria-hidden><Mark size={32} focusable="false" /></span>
        <h1 id="post-success-title" className="tkp-h1" data-tk="step-title">{copy.title}</h1>
        {copy.text ? <p className="tkp-help">{copy.text}</p> : null}
        <div className="tkp-success-cols">
          <div className="tkp-success-col">
            <div className={cardHref ? "tkp-success-card is-link" : "tkp-success-card"}>
              <PostPreviewCard ad={ad} label={t("post.success.adLabel")} hasPhoto={hasPhoto} byline={byline} />
              {cardHref ? <Link href={cardHref} prefetch={false} className="tkp-card-link" data-tk="view-ad" aria-label={ad.title || t("post.success.adLabel")} /> : null}
            </div>
            <ul className="tkp-next" data-tk="what-next">
              {nextSteps(t, live, where, saved, paused).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="tkp-success-col">
            {receipt ? <p className="tkp-receipt" data-tk="receipt">{receipt}</p> : null}
            {plans.length && !saved ? (
              <section className="tkp-upsell" data-tk="upsell" aria-label={t("post.success.moreViews")}>
                <h2 className="tkp-upsell-title">{t("post.success.moreViews")}</h2>
                <ul className="tkp-upsell-list">
                  {plans.map((plan) => (
                    <li key={plan.id}>
                      <span className="tkp-upsell-name">{plan.name}</span>
                      <span className="tkp-upsell-price">{typeof plan.amount === "number" ? creditsText(plan.amount) : ""}</span>
                      <button type="button" className="tkp-btn tkp-btn-small" data-tk="upsell-plan" onClick={() => onPlan(plan)}>
                        {t("post.success.getPlan", { name: plan.name })}
                      </button>
                    </li>
                  ))}
                </ul>
                {planNote ? <p className="tkp-upsell-note" role="status" data-tk="upsell-note">{planNote}</p> : null}
              </section>
            ) : null}
            <div className="tkp-success-actions">
              <a href={anotherHref} className="tkp-btn tkp-btn-primary" data-tk="post-another">{copy.secondary.label}</a>
            </div>
            <button type="button" className="tkp-help-link" data-tk="success-help" onClick={() => openSupportWith("")}>{t("post.success.help")}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
