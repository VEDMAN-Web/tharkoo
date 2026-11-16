# Known e2e failures on main

Checked on a clean main (a16ab1e, production webpack build, local, port 4410). These fail without any change from the post-ad work. Fix them in the lane named, then delete the line.

## tests/e2e/listing-availability.e2e.ts: FIXED in H7.110 (test-only). The badge shows only when the advertiser has Live chat on, and the Home card shows Online now only, so the spec now turns Live chat on and expects no badge on a card while Away. The Call button is no longer paused while Away (removed in the H7.11 ad page redesign), so those two expectations were dropped.

## tests/e2e/money.e2e.ts (FIXED in H7.103)
- Rewritten for the recharge sheet and the API pack purchase; the TOP ranking wait used the old card markup (`article.tk-card`) and now reads the first ad link of the feed. All 12 tests pass at 390 and 1440.

## Lane A lines (checked on main 8a019dc plus the H7.111 Blog change, local production build, desktop-1440 and phone-390)
- tests/e2e/ad-counts.e2e.ts: passes now. The old failures were a stale card link selector, an admin login missing in the local server setup and a real bug (views were not counted on the new ad page); all fixed in #218. Delete this line.
- tests/e2e/visitor.e2e.ts (home to category to city feed, filters, ad page; both projects): STALE TEST. It looks for `[data-tk=home-card]` and `[data-tk=filter-chip]`, which the new Home and the new listing pages no longer have (the Home card is `home-ad`, the active filters are `[data-tk=active-chips] .tkn-sr-chip`). Rewrite the three tests; no app bug found.
- tests/e2e/search.e2e.ts (6 tests, both projects): STALE TEST. Five of them click `[data-tk=hero-search]`, which the new Home does not have (the search pop-up opens from the listing pages through the "tk-open-search" event). The sixth ("empty result shows an empty state") expects no cards for a nonsense search, but the page now shows "ads close by" under the empty message by design (H7.32). Rewrite against the new search page; no app bug found.
- tests/e2e/h7-4d-followups.e2e.ts: (a) footer brand spacing (both projects): STALE TEST, it measures `.tkn-brand` and the "FREE CLASSIFIEDS" line that the logo image (H7.105) replaced. (b) the chat panel and the search pop-up do not close on Escape at 390 px (phone project only; they close on desktop): POSSIBLE REAL BUG, low impact (a phone has no Escape key, a hardware keyboard has), not found in this lane's change; needs its own look in the support chat and search pop-up focus trap at narrow widths.
- tests/e2e/listing-availability.e2e.ts (already listed above): on the new Home card the badge exists only as "Online" (`[data-tk=availability][data-status=online]`) and there is no Away badge on cards by design (no tags on cards, Opus #200); the ad page lost the hook in the H7.99 redesign. Needs a product answer from Opus: should the ad page and the card still show Away? If not, rewrite the spec; if yes, put the badge back.
