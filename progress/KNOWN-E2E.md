# Known e2e failures on main

Checked on a clean main (a16ab1e, production webpack build, local, port 4410). These fail without any change from the post-ad work. Fix them in the lane named, then delete the line.

## tests/e2e/listing-availability.e2e.ts (all 4 tests, phone-390 and desktop-1440; the job-ad Call test passes at 390)
- What fails: `[data-tk=availability]` is not found on cards or the ad page (expected online or away).
- Likely cause: the Online now and Away badge markup changed (card and ad page redesign, H7.99b, H7.104) and lost the `data-tk=availability` hook, or the badge only shows for people ads with the switch on.
- Owner: Lane that owns the card and ad page (Lane A or C). Not caused by H7.86, H7.81 or H7.82.

## tests/e2e/money.e2e.ts (buy credits, PAY disabled, webhook without Origin, buy credits and apply TOP: fail at 390; coupon error states and PAY needs a signed-in account pass)
- What fails: there is no button named "PAY" on /u/account/credits/ (`getByRole('button', { name: 'PAY', exact: true })` not found) and the wait for the pack checkout response `/api/wallet/packs` times out after 60 s.
- Likely cause: the credits page was renamed and restyled (credits wording, H7.74) and the pack picker no longer has a PAY button or posts to another route; H7.103 (recharge sheet and mock checkout) replaces this flow.
- Owner: Lane C (H7.103). Rewrite the spec for the new recharge flow when it lands.
