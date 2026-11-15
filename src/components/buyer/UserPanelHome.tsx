import Link from "next/link";
import { DiscoverFeed } from "./DiscoverFeed";
import { SavedAdsRail } from "./SavedAdsRail";
import { SectionHelp } from "@/components/help/SectionHelp";
import { SignedOutPanel, UserPanelShell } from "./UserPanelShell";
import type { PackRow, PanelSummary } from "@/server/notifications/summary";

/** H7.6, H7.17: the user panel home (New design). Every number here comes from the server. */

type Option = { slug: string; name: string };

function inr(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function UserPanelHome({
  summary,
  packs,
  categories,
  cities,
}: {
  summary: PanelSummary;
  packs: PackRow[];
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
      <section className="up-hero" aria-labelledby="panel-hero">
        <p className="up-eyebrow">{summary.signedIn ? `Hello ${summary.displayName}` : "Welcome to Tharkoo"}</p>
        <h1 id="panel-hero" className="up-h1">Find it, save it, chat with the seller</h1>
        <p className="up-lead">Use coins for video calls with sellers and to support them directly.</p>
      </section>

      <section aria-labelledby="buy-heading" className="up-glass up-panel">
        <div className="up-panel-head">
          <h2 id="buy-heading" className="up-h2">Buy coins</h2>
          <p className="up-muted">Packs on sale now</p>
        </div>
        {packs.length === 0 ? (
          <p className="up-muted">No coin packs are on sale right now.</p>
        ) : (
          <ul className="up-packs">
            {packs.map((pack) => (
              <li key={pack.id}>
                <Link href="/u/account/credits/" className="up-pack">
                  {pack.tag ? <span className="up-pack-tag">{pack.tag}</span> : null}
                  <span className="up-pack-coins">{pack.credits + (pack.bonus || 0)}</span>
                  <span className="up-pack-unit">coins{pack.bonus ? ` (${pack.credits} + ${pack.bonus} free)` : ""}</span>
                  <span className="up-pack-price">{inr(pack.price)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SavedAdsRail />
      <DiscoverFeed categories={categories} cities={cities} />
    </UserPanelShell>
  );
}
