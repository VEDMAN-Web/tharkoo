import Link from "next/link";
import { draftPath } from "@/lib/ui/ad-status";
import type { TextFn } from "@/lib/ui/text";
import type { DashboardAd, SellerDashboard } from "@/server/listings/seller-dashboard";
import { PromoteButton } from "./PromoteButton";
import { num } from "./format";

function statusOf(ad: DashboardAd, t: TextFn) {
  if (ad.status === "review") return { text: t("panel.dash.adsReview"), tone: "review" };
  if (ad.endsInDays === null) return { text: t("panel.dash.adsLive"), tone: "live" };
  if (ad.endsInDays === 0) return { text: t("panel.dash.adsEndsToday"), tone: "soon" };
  return { text: ad.endsInDays === 1 ? t("panel.dash.adsEndsOne") : t("panel.dash.adsEnds", { days: ad.endsInDays }), tone: "soon" };
}

function trendOf(ad: DashboardAd, t: TextFn) {
  if (!ad.trend) return null;
  if (ad.trend.kind === "boost") return { text: t("panel.dash.adsTrendBoost", { times: ad.trend.times }), up: true };
  const up = ad.trend.percent >= 0;
  return { text: t(up ? "panel.dash.adsTrendUp" : "panel.dash.adsTrendDown", { percent: num(Math.abs(ad.trend.percent)) }), up };
}

function Row({ ad, t, bumpPlanId }: { ad: DashboardAd; t: TextFn; bumpPlanId: string | null }) {
  const status = statusOf(ad, t);
  const trend = trendOf(ad, t);
  return (
    <li className="up-dash-ad" data-tk="dash-ad">
      <div className="up-dash-ad-main">
        {ad.photo ? <img className="up-dash-thumb" src={ad.photo} alt="" width={72} height={72} loading="lazy" /> : <span className="up-dash-thumb" aria-hidden="true" />}
        <div className="up-dash-ad-text">
          <Link href={ad.slug ? `/ad/${ad.slug}/` : draftPath(ad.id)} className="up-dash-ad-title" prefetch={false}>
            {ad.title}
          </Link>
          <span className="up-dash-ad-where">{ad.where}</span>
          <span className={`up-dash-status up-dash-status-${status.tone}`}>{status.text}</span>
        </div>
      </div>
      <div className="up-dash-num">
        <span className="up-dash-num-label">{t("panel.dash.adsViews")}</span>
        <span className="up-dash-num-value" data-tk="ad-views">{num(ad.views)}</span>
        {trend ? <span className={`up-dash-trend ${trend.up ? "up-dash-trend-up" : "up-dash-trend-down"}`}>{trend.text}</span> : null}
      </div>
      <div className="up-dash-num">
        <span className="up-dash-num-label">{t("panel.dash.adsClicks")}</span>
        <span className="up-dash-num-value" data-tk="ad-clicks">{num(ad.clicks)}</span>
      </div>
      <div className="up-dash-rank up-dash-ad-where-cell">
        {ad.rank ? (
          <>
            <span className="up-dash-rank-main" data-tk="ad-rank">{t("panel.dash.adsRank", { position: num(ad.rank.position), where: ad.rank.inWhat })}</span>
            <span className="up-dash-rank-note">{ad.rank.above === 0 ? t("panel.dash.adsRankTop") : t("panel.dash.adsRankNote", { page: ad.rank.page, above: num(ad.rank.above) })}</span>
          </>
        ) : ad.status === "live" ? (
          <span className="up-dash-rank-note">{t("panel.dash.adsRankNone")}</span>
        ) : null}
      </div>
      <div className="up-dash-btns">
        {ad.status === "live" ? (
          <PromoteButton listingId={ad.id} title={ad.title} className="up-dash-btn up-dash-btn-main">
            {t("panel.dash.adsBoost")}
          </PromoteButton>
        ) : null}
        {ad.status === "live" && ad.endsInDays !== null ? (
          <Link href="/u/account/ads/" className="up-dash-btn up-dash-btn-alt" data-tk="dash-renew" prefetch={false}>
            {t("panel.dash.adsRenew")}
          </Link>
        ) : ad.second === "bump" && ad.status === "live" ? (
          <PromoteButton listingId={ad.id} title={ad.title} planId={bumpPlanId} className="up-dash-btn up-dash-btn-alt">
            {t("panel.dash.adsBump")}
          </PromoteButton>
        ) : (
          <Link href={draftPath(ad.id)} className="up-dash-btn up-dash-btn-alt" prefetch={false}>
            {t("panel.dash.adsImprove")}
          </Link>
        )}
      </div>
    </li>
  );
}

/** H14.3: the ad rows (at most 5). The whole row opens the ad; the buttons do their own thing. */
export function DashAds({ dash, t }: { dash: SellerDashboard; t: TextFn }) {
  return (
    <section aria-labelledby="dash-ads-h" className="up-dash-card" data-tk="dash-ads">
      <div className="up-dash-ads-head">
        <h2 id="dash-ads-h" className="up-dash-h2">{t("panel.dash.adsTitle")}</h2>
        <Link href="/u/account/analytics/" className="up-dash-link" data-tk="dash-see-all">{t("panel.dash.adsAll", { count: dash.counts.all })}</Link>
      </div>
      <div className="up-dash-adhead" aria-hidden="true">
        <span />
        <span>{t("panel.dash.adsViews")}</span>
        <span>{t("panel.dash.adsClicks")}</span>
        <span>{t("panel.dash.adsWhere")}</span>
        <span />
      </div>
      <ul className="up-dash-list">
        {dash.ads.map((ad) => (
          <Row key={ad.id} ad={ad} t={t} bumpPlanId={dash.bumpPlanId} />
        ))}
      </ul>
    </section>
  );
}
