# E1-A: Visitor + Support (Lane A)

Build: fresh LOCAL production build of main 6366c9f, in-memory Mongo with the normal seed, test payments on, 1 worker, port 4400, projects desktop-1440 and phone-390. Nothing was fixed; no test was weakened, skipped or deleted. Shots: `.relay/shots/e1/` (files start `e1a`).

## 1. Existing area specs (31 files, 294 tests): 249 passed, 43 skipped by design, 2 failed
Skips are the specs' own project gates (a spec that runs at one width). The two failures are in the bug list (E1-A5, E1-A6). `h7-104-home` (known red) is not in this lane's list and was not run.

| Journey (existing spec) | desktop | phone | bug |
|---|---|---|---|
| visitor, search, a49-search, countries, new-live-pages, public-words, coming-soon-screens, listing-availability | PASS | PASS | |
| home-hero, home-selection, age-gate, top-bar, login-sheet, footer, help-page | PASS | PASS | |
| home-cards (H6.13 category card photos) | FAIL | skipped | E1-A6 |
| home-ad-cards (card, heart, slider, pop-out) | FAIL (1 test: the pop-out one; 9 pass) | PASS | E1-A5 |
| ad-page, ad-page-content, ad-gallery, ad-counts, ad-wording, card-width | PASS | PASS | |
| h14-1-listing-rows, h14-1b-row-popout (never on touch or phone), h14-2-whole-card-link, h14-2c-row-cards | PASS | PASS | |
| support-chat, support (ticket create, reply, staff reply, close, reopen), a43-desk | PASS | PASS | |
| h7-131-chat-flows | PASS | PASS | |

## 2. New journey specs (tests/e2e/e1a-visitor-journeys.e2e.ts, in the PR): 17 tests per project, 102 passed in 3 runs in a row (0 flaky)
Each ends by asserting no console errors, and checks the single h1, no sideways scroll and the serious or critical axe check where the page is a whole page.

| Journey | desktop | phone | bug |
|---|---|---|---|
| J1 save without login: the heart saves on the device, survives a reload, the saved list shows it | PASS | PASS | note 1; E1-A3 below |
| J2 report an ad: link on the ad page, form opens, a reason is required | PASS | PASS | |
| J2s sending a report (attachment, failing) | FAIL | FAIL | E1-A1, E1-A7 |
| J3 share or copy link (attachment, failing) | FAIL | FAIL | E1-A2 |
| J4 404 page: status 404, h1, way home, ads, no scroll, axe | PASS | PASS | |
| J5 How it works: h1, FAQ, cost answer follows the live rule, post link | PASS | PASS | |
| J6 legal and info pages (terms, privacy, cookies, grievance, prohibited-items, safety, contact, help): 200, one h1, real text, no scroll, axe | PASS | PASS | |
| J6s /scam-report/ has real text (attachment, failing) | FAIL | FAIL | E1-A4 |
| J6b footer links to Terms and Privacy | PASS | PASS | |
| J7 category + city listing: sort, then a quick filter (in the Filters sheet on the phone) keeps the page and the count honest | PASS | PASS | |
| J8 hover pop-out on the listing: opens on a computer, NEVER on the phone | PASS | PASS | |
| J9 guest support ticket from the chat bubble reaches support | PASS | PASS | note 2 |
| J10 18+ notice on a people category listing and ad page | PASS | PASS | |
| J1b saved card place line (attachment, failing) | FAIL | FAIL | E1-A3 |

The failing journeys fail 3 of 3 runs on both projects (30 of 30). They are in `progress/E1-A-failing-journeys.e2e.ts.txt`, NOT in the PR (to be renamed to `.e2e.ts` and marked `test.fixme` with the bug id only when Opus confirms).

## 3. Bug list (no fixing)

**E1-A1 (high): "Report this ad" never works.**
Steps: open any ad, for example /ad/demo-0352/ (or an ad of a real account, /ad/e2e-chatflow-.../), click Report this ad, choose "Fake or misleading ad", press Send report.
Expected: "Thank you. Our team reviews every report."
Actual: the form stays and shows "That ad could not be found"; the API answers 404. The link is `/submit-report/?ad=0352` (only the number at the end of the address), while the report API looks the ad up by its whole address or a stored public id. Every ad whose address has a hyphen fails (all seen). Sending the full address works (API 200).
Suspected files: `src/lib/queries.ts` lines 233 and 244 (the public id is made from the end of the slug), `src/components/new/AdActions.tsx:13` (`?ad=${publicId || slug}`), `src/server/reports/service.ts:49`.
Screenshot: `e1a1-report-fails-1440.png`, `e1a1-report-fails-390.png`. Tests: J2s and J2b in the attachment.

**E1-A7 (medium): the Report page (/submit-report/) looks unstyled.**
Steps: open /submit-report/?ad=... at 1440 or 390.
Expected: the site's page style: sans heading, label, select and details box stacked, full-width button.
Actual: serif heading, the reason select on the same line as its label, the "More details" box a tiny field with its caption floating to the right, little spacing.
Suspected: `src/app/submit-report/ReportForm.tsx` and its page classes (`tk-input`, `t-*` from the older design).
Screenshot: same as E1-A1.

**E1-A2 (medium): no Share or Copy link on the ad page.**
Steps: open an ad at 1440 or 390 and look for Share or Copy link.
Expected: a share or copy-link control (the E1 plan lists share; the older ad page had one).
Actual: only Save this ad and Report this ad.
Suspected: `src/components/new/AdActions.tsx` (the old `CopyLinkButton` in `src/app/ad/[slug]/AdClientBits.tsx` is no longer used on the new page).
Screenshot: `e1a-j2-ad-page-1440x900.png`. Test: J3 in the attachment.

**E1-A3 (low): a saved ad's place line reads "/ Bengaluru".**
Steps: save an ad with its heart, open /u/account/saved/.
Expected: "Bengaluru" (or "Bengaluru / area") with the category line.
Actual: "/ Bengaluru", an empty calendar line, and no price or category on the saved card.
Suspected: `src/components/ui/AdCard.tsx` place line when the saved item has only `place` (SavedPanel.tsx and SavedAdsRail.tsx pass no city).
Screenshot: `e1a-j1-saved-list-390x844.png`. Test: J1b in the attachment.

**E1-A4 (low or medium): /scam-report/ is nearly empty.**
Steps: open /scam-report/.
Expected: a real page (how to spot a scam, how to report one).
Actual: one sentence (156 characters) under the heading.
Suspected: `src/app/scam-report/page.tsx` and the content it reads.
Screenshot: `e1a4-scam-report-1440.png`. Test: J6s in the attachment.

**E1-A5 (test fragility, existing spec): the Home pop-out test can fail on leftover data.**
`tests/e2e/home-ad-cards.e2e.ts:170` looks for a link named "Chat" inside the pop-out. The pop-out's title is also a link, and when the first Home ad is titled "E2E chatflow ..." (left by an earlier spec in the same database) both match and the check stops (strict mode). Rate: 1 of 1 in the full run, 0 of 3 when run alone. Fix idea: `getByRole("link", { name: "Chat", exact: true })`.

**E1-A6 (stale test, existing spec): H6.13 category card photo shape.**
`tests/e2e/home-cards.e2e.ts:28` expects a 4:5 photo at 360 px; the category tiles are now an icon strip 64 px tall (H12.2 and H12.2b design), so it measures 0.42. The tiles look right (`e1a6-category-tiles-1440.png`). Fails 3 of 3. The fix belongs to the test (or retire the check).

## Notes for Opus (not bugs)
1. "Save without login -> login prompt" does not match the product: a visitor's saved ads are kept on the device by design (the list says "N saved on this device") and no login is asked. If a login prompt is wanted, that is a product decision. The saved list also shows the account menu (My ads, Photos and videos) to a signed-out visitor.
2. A guest's support thread opens only from the link in the email (the API does not return the token, and it is not reachable in e2e). J9 checks that the ticket reaches support with the guest's words and contact.
3. The pop-out never appears on phone-390 (J8, and h14-1b "a phone width shows no pop-out even with a mouse", both pass).
4. The 18+ notice is present on the Dating listing, the ad page and the footer (J10).
