import Link from "next/link";
import { DiscoverFeed } from "./DiscoverFeed";
import { MyAdsList } from "./MyAdsList";
import { SavedAdsRail } from "./SavedAdsRail";
import { SectionHelp } from "@/components/help/SectionHelp";
import { SignedOutPanel, UserPanelShell } from "./UserPanelShell";
import { howItWorksPath } from "@/lib/urls";
import type { listOwnCards } from "@/server/listings/owner-cards";
import type { PanelSummary } from "@/server/notifications/summary";

/** H7.6, H7.17: the user panel home (New design). Every number here comes from the server. */

type Option = { slug: string; name: string };
type Ads = Awaited<ReturnType<typeof listOwnCards>>;

export function UserPanelHome({
  summary,
  ads,
  categories,
  cities,
}: {
  summary: PanelSummary;
  ads: Ads | null;
  categories: Option[];
  cities: Option[];
}) {
  const aside = (
    <>
      <section aria-labelledby="coins-heading" className="up-coins-card">
        <h2 id="coins-heading" className="up-coins-label">Your coins</h2>
        {summary.signedIn ? (
          <p className="up-coins-value" data-tk="coin-balance">{summary.balance} coins</p>
        ) : (
          <p className="up-coins-worth">Log in to see your coin balance.</p>
        )}
        <Link href="/u/account/credits/history/" className="up-coins-link">See history</Link>
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
    <UserPanelShell active="home" summary={summary} aside={aside}>
      {summary.signedIn ? null : (
        <SignedOutPanel next="/u/account/dashboard/" title="Log in to see your panel" body="Your saved ads, chats and coins show here after you log in." />
      )}
      {summary.signedIn && ads ? (
        <>
          <section className="up-hero" aria-labelledby="panel-hero">
            <p className="up-eyebrow">{`Hello ${summary.displayName}`}</p>
            <h1 id="panel-hero" className="up-h1">{ads.totals.views > 0 ? "Your ads are getting seen" : "Your ads are live"}</h1>
            <p className="up-lead">{`${ads.counts.live} live now · ${ads.totals.views} views in total`}</p>
            <div className="up-promo-row" style={{ marginTop: 16 }}>
              <Link href="/u/post-insert/" className="up-btn">Post another ad</Link>
            </div>
          </section>
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
            <p className="up-eyebrow">{summary.signedIn ? `Hello ${summary.displayName}` : "Welcome to Tharkoo"}</p>
            <h1 id="panel-hero" className="up-h1">Find it, save it, chat with the seller</h1>
            <p className="up-lead">Your saved ads, chats and coins in one place.</p>
          </section>
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

      <SavedAdsRail />
      <DiscoverFeed categories={categories} cities={cities} />
    </UserPanelShell>
  );
}
