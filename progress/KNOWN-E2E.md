# Known e2e failures on main

Checked on a clean main (a16ab1e, production webpack build, local, port 4410). These fail without any change from the post-ad work. Fix them in the lane named, then delete the line.

## tests/e2e/listing-availability.e2e.ts (all 4 tests, phone-390 and desktop-1440; the job-ad Call test passes at 390)
- What fails: `[data-tk=availability]` is not found on cards or the ad page (expected online or away).
- Likely cause: the Online now and Away badge markup changed (card and ad page redesign, H7.99b, H7.104) and lost the `data-tk=availability` hook, or the badge only shows for people ads with the switch on.
- Owner: Lane that owns the card and ad page (Lane A or C). Not caused by H7.86, H7.81 or H7.82.

## tests/e2e/money.e2e.ts (FIXED in H7.103)
- Rewritten for the recharge sheet and the API pack purchase; the TOP ranking wait used the old card markup (`article.tk-card`) and now reads the first ad link of the feed. All 12 tests pass at 390 and 1440.
