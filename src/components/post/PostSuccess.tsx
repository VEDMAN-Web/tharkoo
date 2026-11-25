import Link from "next/link";
import { ArrowRight, CircleCheck, Clock, Images } from "lucide-react";
import type { ListingDoc } from "@/lib/models";
import { useT } from "@/components/help/UiTextProvider";
import type { TextFn } from "@/lib/ui/text";
import { openSupportWith } from "@/components/recharge/openRecharge";
import type { SuccessCopy } from "./newCopy";
import "./post-success.css";

export type UpsellPlan = { id: string; name: string; amount?: number; code?: string; description?: string };

/** What the done screen needs that the ad card itself does not carry. Built in the wizard from the form. */
export type SuccessFacts = {
  city: string;
  category: string;
  /** Area and city, e.g. "Adajan, Surat". */
  place: string;
  /** Category first, then the interests, shown as small tags. */
  tags: string[];
  /** The boost bought with this ad, when there is one. */
  boost: { name: string; endsAt: string | null; credits: number } | null;
  /** The plan the person chose when the ad was held for review (nothing is charged then). */
  chosenName: string;
};

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
  facts?: SuccessFacts;
  /** H7.118: an edit of a posted ad was saved. No fee, no upsell. */
  saved?: boolean;
  paused?: boolean;
};

function nextSteps(t: TextFn, where: string, paused: boolean): string[] {
  return [
    paused ? t("post.success.stillPaused") : t("post.success.changesLive"),
    t("post.success.seeViews"),
    t("post.success.pauseRenew"),
    ...(where ? [] : []),
  ];
}

const UNTIL: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" };

/** H21.7: the done screens. A banner (green when live, amber in review), the ad as one clickable card, what happens now, and what else can be done. */
export function PostSuccess({ copy, live, where, ad, hasPhoto, byline, anotherHref, adHref, receipt, plans, planNote, onPlan, facts, saved = false, paused = false }: Props) {
  const t = useT();
  const Mark = live ? CircleCheck : Clock;
  const photo = hasPhoto ? ad.photos?.[0] : undefined;
  const photoCount = ad.photos?.length ?? 0;
  const title = ad.title || "";
  const isLive = live && !paused;
  const linkHref = adHref && isLive ? adHref : "/u/account/ads/";
  const city = facts?.city ?? "";
  const category = facts?.category ?? "";
  const boost = facts?.boost ?? null;
  const until = boost?.endsAt ? new Date(boost.endsAt).toLocaleString("en-IN", UNTIL) : "";
  const upgrade = plans.find((plan) => plan.code === "super-top");
  const bump = plans.find((plan) => plan.code === "bump");
  const boostIsSuperTop = Boolean(boost && /super/i.test(boost.name));
  const offers = saved ? [] : [upgrade && !boostIsSuperTop ? upgrade : null, bump ?? null].filter((plan): plan is UpsellPlan => Boolean(plan));
  const subline = saved
    ? copy.text
    : live
      ? boost
        ? until
          ? t("post.v2.done.boostOn", { name: boost.name, until, credits: boost.credits })
          : t("post.v2.done.boostOnNoDate", { name: boost.name, credits: boost.credits })
        : city && category
          ? t("post.v2.done.liveIn", { city, category })
          : copy.text
      : facts?.chosenName
        ? t("post.v2.done.reviewBoost", { name: facts.chosenName })
        : t("post.v2.done.review");
  const bannerTitle = saved ? copy.title : live ? t("post.v2.done.liveTitle") : t("post.v2.done.reviewTitle");
  const lines = saved
    ? nextSteps(t, where, paused)
    : live
      ? [city && category ? t(boost ? "post.v2.done.nowSeeTop" : "post.v2.done.nowSee", { city, category }) : t("post.success.foundOnSite"), t("post.v2.done.nowChats"), t("post.v2.done.nowEdit")]
      : [t("post.v2.done.waitEdit"), facts?.chosenName ? t("post.v2.done.waitBoost", { name: facts.chosenName }) : t("post.v2.done.waitEmail")];
  return (
    <div className="tkdn" data-design="post-new" data-tk="post-success" data-state={saved ? "saved" : live ? "live" : "review"}>
      <div className="tkdn-banner" role="status" data-tone={live ? "live" : "review"}>
        <span className="tkdn-banner-mark" aria-hidden><Mark size={26} focusable="false" /></span>
        <div className="tkdn-banner-text">
          <h1 id="post-success-title" data-tk="step-title">{bannerTitle}</h1>
          {subline ? <p data-tk="done-sub">{subline}</p> : null}
        </div>
      </div>
      <div className="tkdn-cols">
        <div className="tkdn-main">
          <Link href={linkHref} prefetch={false} className="tkdn-card" data-tk="view-ad">
            <span className="tkdn-thumb">
              {photo ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="tkdn-thumb-blur" src={photo} alt="" aria-hidden />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="tkdn-thumb-fit" src={photo} alt="" />
                </>
              ) : null}
              {saved ? null : boost && live ? <span className="tkdn-badge" data-tone="live">{boost.name}</span> : !live ? <span className="tkdn-badge" data-tone="review">{t("post.v2.done.reviewBadge")}</span> : null}
              {photoCount > 0 ? <span className="tkdn-count" aria-label={t("post.v2.done.photos", { count: photoCount })}><Images size={12} aria-hidden />{photoCount}</span> : null}
            </span>
            <span className="tkdn-body">
              <span className="tkdn-status" data-tone={live ? "live" : "review"}>{live ? t("post.v2.done.statusLive") : t("post.v2.done.statusReview")}</span>
              <span className="tkdn-title">{title}</span>
              {facts?.place || byline ? <span className="tkdn-place">{[facts?.place, byline].filter(Boolean).join(" · ")}</span> : null}
              {facts?.tags.length ? (
                <span className="tkdn-tags">
                  {facts.tags.slice(0, 6).map((tag, index) => (
                    <span key={`${tag}-${index}`} className="tkdn-tag" data-kind={index === 0 ? "category" : "interest"}>{tag}</span>
                  ))}
                </span>
              ) : null}
              <span className="tkdn-foot">
                <span className="tkdn-posted">{t("post.v2.done.posted")}</span>
                <span className="tkdn-open">{t(isLive ? "post.v2.done.open" : "post.v2.done.preview")}<ArrowRight size={14} aria-hidden /></span>
              </span>
            </span>
          </Link>
          {receipt ? <p className="tkdn-receipt" data-tk="receipt">{receipt}</p> : null}
          <section className="tkdn-box" aria-label={live ? t("post.v2.done.nowTitle") : t("post.v2.done.waitTitle")}>
            <h2 className="tkdn-sec">{saved || live ? t("post.v2.done.nowTitle") : t("post.v2.done.waitTitle")}</h2>
            <ul className="tkdn-next" data-tk="what-next">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        </div>
        <aside className="tkdn-side">
          {offers.length && live ? (
            <section className="tkdn-box tkdn-offers" data-tk="upsell" aria-label={t("post.v2.done.moreTitle")}>
              <h2 className="tkdn-sec">{t("post.v2.done.moreTitle")}</h2>
              <ul>
                {offers.map((plan) => (
                  <li key={plan.id}>
                    <span className="tkdn-offer-t">{plan.code === "super-top" ? t("post.v2.done.upgrade", { name: plan.name }) : plan.name}</span>
                    {plan.description ? <span className="tkdn-offer-d">{plan.description}</span> : null}
                    <button type="button" className="tkdn-btn tkdn-btn-s" data-tk="upsell-plan" onClick={() => onPlan(plan)}>
                      {typeof plan.amount === "number" ? t("post.v2.done.price", { count: plan.amount }) : plan.name}
                    </button>
                  </li>
                ))}
              </ul>
              {planNote ? <p className="tkdn-note" role="status" data-tk="upsell-note">{planNote}</p> : null}
            </section>
          ) : null}
          {live && !saved ? (
            <button type="button" className="tkdn-help-link" data-tk="success-help" onClick={() => openSupportWith("")}>{t("post.success.help")}</button>
          ) : (
            <section className="tkdn-box" data-tk="help-box">
              <h2 className="tkdn-sec">{t("post.v2.done.helpTitle")}</h2>
              <p>{t("post.v2.done.helpText")}</p>
              <button type="button" className="tkdn-btn tkdn-btn-s" data-tk="success-help" onClick={() => openSupportWith("")}>{t("post.v2.done.helpBtn")}</button>
            </section>
          )}
        </aside>
      </div>
      <div className="tkdn-actions">
        <Link href="/u/account/ads/" className="tkdn-btn tkdn-btn-p" data-tk="my-ads">{t("post.v2.done.myAds")}</Link>
        <a href={anotherHref} className="tkdn-btn" data-tk="post-another">{copy.secondary.label}</a>
      </div>
    </div>
  );
}
