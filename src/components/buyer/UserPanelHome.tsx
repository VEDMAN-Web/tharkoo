import Link from "next/link";
import { FreshAds } from "./FreshAds";
import { PackPicker } from "./PackPicker";
import { MyAdsList } from "./MyAdsList";
import { SavedAdsRail } from "./SavedAdsRail";
import { SectionHelp } from "@/components/help/SectionHelp";
import { SignedOutPanel, UserPanelShell } from "./UserPanelShell";
import { howItWorksPath } from "@/lib/urls";
import { makeT } from "@/lib/ui/text";
import { AvailabilityControls } from "@/components/vendor/AvailabilityControls";
import { TourInbox } from "@/components/vendor/TourInbox";
import type { listOwnCards } from "@/server/listings/owner-cards";
import type { PackRow, PanelSummary } from "@/server/notifications/summary";

/** H7.6, H7.17: the user panel home (New design). Every number here comes from the server. */

type Ads = Awaited<ReturnType<typeof listOwnCards>>;

const t = makeT();

function homeHeadline(ads: Ads) {
  const { live, review, draft } = ads.counts;
  if (live > 0) return { title: t(ads.totals.views > 0 ? "panel.home.title.seen" : "panel.home.title.live"), lead: `${live} live now · ${ads.totals.views} views in total`, action: "Post another ad", href: "/u/post-insert/" };
  if (draft > 0) return { title: t("panel.home.title.draft"), lead: t("panel.home.lead.draft"), action: "Finish your ad", href: "/u/account/ads/" };
  if (review > 0) return { title: t("panel.home.title.review"), lead: t("panel.home.lead.review"), action: "See my ads", href: "/u/account/ads/" };
  return { title: t("panel.home.title.ended"), lead: t("panel.home.lead.ended"), action: "Post an ad", href: "/u/post-insert/" };
}

export function UserPanelHome({
  summary,
  ads,
  packs,
}: {
  summary: PanelSummary;
  ads: Ads | null;
  packs: PackRow[];
}) {
  const headline = ads ? homeHeadline(ads) : null;
  const aside = (
    <>
      <section aria-labelledby="coins-heading" className="up-coins-card">
        <h2 id="coins-heading" className="up-coins-label">{t("panel.coins.title")}</h2>
        {summary.signedIn ? (
          <p className="up-coins-value" data-tk="coin-balance">{t("panel.coins.balance", { count: summary.balance })}</p>
        ) : (
          <p className="up-coins-worth">{t("panel.coins.help")}</p>
        )}
        <div className="up-promo-row">
          <Link href="/u/account/credits/history/" className="up-coins-link">See history</Link>
          {summary.signedIn && summary.seller ? <Link href="/u/account/wallet/?tab=earnings" className="up-coins-link" data-tk="withdraw">{t("panel.coins.withdraw")}</Link> : null}
        </div>
      </section>
      <section aria-labelledby="support-heading" className="up-glass up-panel">
        <div className="up-panel-head">
          <h2 id="support-heading" className="up-h2">Help and support</h2>
          <Link href="/u/account/support/" className="up-link">Open</Link>
        </div>
        <SectionHelp textKey="help.section.support" />
        {summary.signedIn && summary.unreadSupport > 0 ? (
          <div className="up-reply">
            <span className="up-pill">New reply</span>
            <span className="up-reply-text">A ticket has a reply from support</span>
          </div>
        ) : (
          <p className="up-muted">No new replies from support.</p>
        )}
        <Link href="/u/account/support/new/" className="up-dashed" style={{ marginTop: 12 }}>Raise a new ticket</Link>
      </section>
    </>
  );
  return (
    <UserPanelShell active="home" summary={summary} aside={aside} below={<FreshAds />}>
      {summary.signedIn ? null : (
        <SignedOutPanel next="/u/account/dashboard/" title="Log in to see your panel" body="Your saved ads, chats and credits show here after you log in." />
      )}
      {summary.signedIn && ads && headline ? (
        <>
          <section className="up-hero" aria-labelledby="panel-hero">
            <p className="up-eyebrow">{`Hello ${summary.displayName}`}</p>
            <h1 id="panel-hero" className="up-h1">{headline.title}</h1>
            <p className="up-lead">{headline.lead}</p>
            <div className="up-promo-row" style={{ marginTop: 16 }}>
              <Link href={headline.href} className="up-btn">{headline.action}</Link>
            </div>
          </section>
          {summary.seller ? <AvailabilityControls /> : null}
          <div className="up-stats">
            <div className="up-stat"><span className="up-stat-num">{ads.counts.live}</span><span className="up-stat-label">Live ads</span></div>
            <div className="up-stat"><span className="up-stat-num">{ads.totals.views}</span><span className="up-stat-label">Views</span></div>
            <div className="up-stat"><span className="up-stat-num">{ads.counts.review}</span><span className="up-stat-label">In review</span></div>
            <div className="up-stat"><span className="up-stat-num">{ads.counts.ended}</span><span className="up-stat-label">Ended</span></div>
          </div>
          <section aria-labelledby="my-ads-heading" className="up-glass up-panel">
            <div className="up-panel-head">
              <h2 id="my-ads-heading" className="up-h2">My ads</h2>
              <Link href="/u/account/ads/" className="up-link">{`See all ${ads.counts.all}`}</Link>
            </div>
            <MyAdsList items={ads.items} />
          </section>
        </>
      ) : (
        <>
          <section className="up-hero" aria-labelledby="panel-hero">
            <p className="up-eyebrow">{summary.signedIn ? `Hello ${summary.displayName}` : t("panel.home.eyebrow.guest")}</p>
            <h1 id="panel-hero" className="up-h1">{t("panel.home.title.empty")}</h1>
            <p className="up-lead">{t("panel.home.lead.empty")}</p>
          </section>
          {summary.signedIn && summary.seller ? <AvailabilityControls /> : null}
          {summary.signedIn ? (
            <section aria-labelledby="promo-heading" className="up-promo">
              <p className="up-promo-kicker">FREE TO POST</p>
              <h2 id="promo-heading" className="up-promo-title">Have something to offer?</h2>
              <p className="up-promo-text">Post a free ad in 2 minutes. People in your city see it today, and they reach you by chat or video call.</p>
              <div className="up-promo-row">
                <Link href="/u/post-insert/" className="up-btn-white">Post a free ad</Link>
                <Link href={howItWorksPath()} className="up-btn-outline">How it works</Link>
              </div>
            </section>
          ) : null}
        </>
      )}

      {packs.length > 0 ? (
        <section aria-labelledby="buy-heading" className="up-glass up-panel">
          <div className="up-panel-head">
            <h2 id="buy-heading" className="up-h2">{t("panel.coins.buy")}</h2>
            <Link href="/u/account/credits/" className="up-link">See all packs</Link>
          </div>
          <PackPicker packs={packs} />
        </section>
      ) : null}
      <SavedAdsRail />
      {summary.signedIn && summary.seller ? <TourInbox /> : null}
    </UserPanelShell>
  );
}
