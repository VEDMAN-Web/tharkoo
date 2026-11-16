# Known e2e failures on main

Checked on a clean main (a16ab1e, production webpack build, local, port 4410). These fail without any change from the post-ad work. Fix them in the lane named, then delete the line.

## tests/e2e/listing-availability.e2e.ts: FIXED in H7.110 (test-only). The badge shows only when the advertiser has Live chat on, and the Home card shows Online now only, so the spec now turns Live chat on and expects no badge on a card while Away. The Call button is no longer paused while Away (removed in the H7.11 ad page redesign), so those two expectations were dropped.

## tests/e2e/money.e2e.ts (buy credits, PAY disabled, webhook without Origin, buy credits and apply TOP: fail at 390; coupon error states and PAY needs a signed-in account pass)
- What fails: there is no button named "PAY" on /u/account/credits/ (`getByRole('button', { name: 'PAY', exact: true })` not found) and the wait for the pack checkout response `/api/wallet/packs` times out after 60 s.
- Likely cause: the credits page was renamed and restyled (credits wording, H7.74) and the pack picker no longer has a PAY button or posts to another route; H7.103 (recharge sheet and mock checkout) replaces this flow.
- Owner: Lane C (H7.103). Rewrite the spec for the new recharge flow when it lands.
