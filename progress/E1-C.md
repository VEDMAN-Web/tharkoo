# E1-C: Admin end-to-end (Lane C), journeys and bug list

Fresh production build of main at 6366c9f (own worktree), in-memory Mongo with the normal seed, test payments on, Cloudinary and Brevo mocked as the existing e2e setup does. Playwright projects desktop-1440 and phone-390, 1 worker, ports 4430 and 4432. Specs and tables only: NO product change.

## Result

The 43 existing admin specs of the list, plus 5 more that cover the gap list (categories, tile icons, cities, media, prices), pass at both sizes. The only red was one `a25-settings` failure at 1440 (1 in 4 runs; the 3 later runs and the phone run pass: a flake, no product bug). The new journey specs in this PR (12 tests at 1440, 7 at 390, 1 skipped on the phone for E1-C6) all pass. The failing journeys are NOT in the PR: they are in `progress/E1-C-known-bugs.e2e.ts.txt` and each names its bug. Five bugs are listed below (E1-C1, C3, C4, C5, C6). E1-C2 was WITHDRAWN: it was a mistake in my test, not a product bug (see E1-C2). `h7-104-home` is not an admin spec and was not run here.

## Journey table

| journey | desktop 1440 | phone 390 | bug id |
|---|---|---|---|
| NEW roles: superadmin sees every screen, each opens, one h1, no sideways scroll, no serious a11y, no console error | PASS | PASS | E1-C5 (one message ignored, see below) |
| NEW roles: moderator, content_editor, support, finance see only their own screens; every other admin screen answers 403 | PASS | PASS | - |
| NEW roles: blog_editor and seo_editor (menu link opens a closed page) | FAIL | FAIL | E1-C1 |
| NEW post a JOB ad from admin (Publish now): live on its public page and in search | PASS | PASS | - |
| NEW ads sent to moderation: the queue Approves one and Rejects one, status and audit entries | PASS | PASS | - |
| NEW an approved, removed and restored ad is public / gone for a visitor within 10 seconds (kept as test h15-4-approve-visible) | PASS | n/a | E1-C2 withdrawn |
| NEW All ads: remove, it comes down, History Undo puts it back to live | PASS | skipped (no tick boxes on a phone) | E1-C6 |
| NEW audit entry per screen with who / what / when: Prices & plans (free ads per account), recharge pack, coupon, Site text (also shown on the public Home), Users (extra free ads), Page builder (publish) | PASS | n/a (same write, 1440 only) | - |
| NEW audit entry: Cities & areas (new city), Categories (new category), SEO center (title template) | FAIL (no role, no summary) | n/a | E1-C4 |
| History screen loads and settles | FAIL (a request never ends) | not run | E1-C3 |
| Media library large photo (6 MB) | PASS (existing h13-1-staff-upload) | n/a | - |
| Page builder Home, Listing, Post-ad: publish and see it on the public page | PASS (existing a16, a32, a32b, a41) | n/a | - |
| Site text edit shown on the public Home | PASS (new audit spec; existing a47-text) | n/a | - |
| Categories and the no-photo icon | PASS (existing h8-51-categories, h12-2b-tile-icons) | n/a | - |
| Cities | PASS (existing h8-52-cities) | n/a | - |
| Prices and money settings (free ads per account), credit packs, users edit (extra free ads) | PASS (existing a17-prices, a20-packs, a8-users, h11-1-prices; new audit spec) | PASS where the spec runs on a phone | - |
| SEO settings | PASS (existing seo-center) | PASS | - |

### Existing admin specs (run first, nothing changed)

| spec | desktop 1440 | phone 390 | bug id |
|---|---|---|---|
| a2-kit | PASS (9) | PASS (9) | - |
| a4-kit | PASS (8) | PASS (8) | - |
| a5-roles | PASS (6) | n/a (1440 only) | - |
| a7-shell | PASS (5) | n/a (1440 only) | - |
| a8-users | PASS (5) | PASS (5) | - |
| a10-dashboard | PASS (4) | n/a (1440 only) | - |
| a11-ban | PASS (3) | PASS (3) | - |
| a12-gone | PASS (1) | PASS (1) | - |
| a13-home-flag | PASS (1) | n/a (1440 only) | - |
| a14-credits | PASS (2) | PASS (2) | - |
| a15-review | PASS (1) | n/a (1440 only) | - |
| a16-builder | PASS (5) | n/a (1440 only) | - |
| a17-prices | PASS (4) | PASS (4) | - |
| a18-decisions | PASS (1) | n/a (1440 only) | - |
| a19-home-writers | PASS (3) | n/a (1440 only) | - |
| a20-packs | PASS (3) | PASS (3) | - |
| a21-reports | PASS (1) | n/a (1440 only) | - |
| a22-orders | PASS (3) | PASS (3) | - |
| a23-id | PASS (1) | n/a (1440 only) | - |
| a24-refund | PASS (2) | PASS (2) | - |
| a25-settings | PASS on re-run, 1 fail in 4 (flaky) | PASS (4) | flake |
| a26-history | PASS (4) | n/a (1440 only) | - |
| a27-ads | PASS (2) | n/a (1440 only) | - |
| a31-content | PASS (4) | PASS (4) | - |
| a32-listing | PASS (1) | n/a (1440 only) | - |
| a32b-listing-blocks | PASS (2) | n/a (1440 only) | - |
| a33-ad-edit | PASS (2) | n/a (1440 only) | - |
| a33b-ad-edit-2 | PASS (2) | n/a (1440 only) | - |
| a36-forms | PASS (3) | n/a (1440 only) | - |
| a41-post-builder | PASS (3) | n/a (1440 only) | - |
| a43-desk | PASS (2) | PASS (2) | - |
| a44-listing-tab | PASS (2) | PASS (2) | - |
| a45-media | PASS (2) | n/a (1440 only) | - |
| a46-team | PASS (2) | PASS (2) | - |
| a47-text | PASS (2) | n/a (1440 only) | - |
| roles | PASS (7) | PASS (7) | - |
| admin-content | PASS (6) | PASS (6) | - |
| admin-create-ad | PASS (2) | PASS (2) | - |
| bulk-upload | PASS (4) | PASS (4) | - |
| seo-center | PASS (4) | PASS (4) | - |
| h13-1-staff-upload | PASS (4) | n/a (1440 only) | - |
| h10-2-move | PASS (2) | n/a (1440 only) | - |
| h10-5c-undo-settings | PASS (1) | n/a (1440 only) | - |
| h8-51-categories | PASS (8) | n/a (1440 only) | - |
| h12-2b-tile-icons | PASS (3) | n/a (1440 only) | - |
| h8-52-cities | PASS (6) | n/a (1440 only) | - |
| h8-57-media | PASS (3) | n/a (1440 only) | - |
| h11-1-prices | PASS (5) | n/a (1440 only) | - |

"n/a (1440 only)" means every test of that spec skips itself on the phone project by design. The last five rows (h8-51, h12-2b, h8-52, h8-57, h11-1) are not in the list I was given; I ran them because they hold the categories, icon, cities, media and prices journeys.

Flake note: `a25-settings` ("undo windows validate and save, post-moderation turns on and off, search engines and the moved code-only login") failed once at 1440 in 4 desktop runs (an expected-visible check); the 3 following runs and the phone run passed. Rate 1 in 4, no product bug found.

## Audit log: one write per screen (who / what / when)

| screen | write | action | role kept | what it says |
|---|---|---|---|---|
| Prices & plans | free ads per account changed | settings.money.update | superadmin | Changed Posting fee (credits), Price of one credit, Free ads for each account |
| Prices & plans, recharge packs | pack added | pack.create | superadmin | Added the N credits pack |
| Prices & plans, coupons | coupon added | coupon.create | superadmin | Added coupon E1C-... |
| Site text | one text changed | ui_text.update | superadmin | Changed the text: Search all states |
| Users | extra free ads set | user.extra_free_ads | superadmin | Set extra free ads to 3 for ... |
| Page builder | Home published | layout.publish | superadmin | Published the Home page as version N |
| Cities & areas | city added | location.create | MISSING | MISSING (E1-C4) |
| Categories | category added | category.create | MISSING | MISSING (E1-C4) |
| SEO center | title template saved | seo.template.save | MISSING | MISSING (E1-C4) |

For every row the actor is the signed-in admin and the time is inside the write window.

## Bug list

### E1-C1 (Medium): Media library is in the menu of blog_editor and seo_editor but closed to them
- Steps: sign in with an account that has only the blog_editor role (or seo_editor), open /admin/, click "Media library" in the menu.
- Expected: the link opens the library, or the link is not shown.
- Actual: a closed page (no heading, "You cannot open the Media library"). The superadmin sees the same link working.
- Screenshots: .relay/shots/e1/E1-C1-blog-editor-menu-has-media-link-1440.png, E1-C1-blog-editor-media-library-closed-1440.png (and -390).
- Suspected file: src/lib/admin/screens.ts line 79 (the Media library screen is shown to anyone with `media.upload`) against src/app/admin/media/page.tsx (the page only lets `canEditSite`, that is admins and content_editor, in).
- Which fix the perms file implies: src/lib/admin/perms.ts gives `media.library` to content_editor (and admins) only, and `media.upload` (seo_editor, blog_editor, content_editor) is for uploading pictures inside their own screens. So the library is meant for content_editor: the menu should follow permissions, i.e. the screen entry in screens.ts should use `view: "media.library"`, which hides the link for blog_editor and seo_editor. Uploading from their own screens stays as it is.
- Test: kept-out spec e1c-red-roles (blog_editor, seo_editor), fails at both sizes with "/admin/media/: 0 h1 headings".

### E1-C2: WITHDRAWN (my test was wrong, the product is fine)
- What I reported: an approved ad stays 404 for visitors for minutes.
- What was true: an ad in review has no address (slug) yet; the address is given at the moment of approval. My test read the address BEFORE approving, got nothing, and then asked for /ad/undefined/, which is correctly 404 forever. Found by logging the page request (slug was "undefined").
- Re-checked on a fresh build of main: approve -> visitor GET /ad/<slug>/ = 200 within 10 seconds; remove -> not 200 within 10 seconds; restore (History Undo) -> 200 within 10 seconds. The three checks are now a passing regression test, tests/e2e/h15-4-approve-visible.e2e.ts.
- One earlier run saw a 404 right after a History Undo restore (page.goto straight after the click); it did not repeat in 3 later runs of the 10-second check, so it is treated as a timing slip in that first test, not a bug. No FIX-4 is needed.
- Sorry for the extra work: FIX-4 can be dropped.

### E1-C3 (Low): the History screen never settles
- Steps: open /admin/history/ and wait for the network to be quiet.
- Expected: it settles in a second or two like the other admin screens.
- Actual: a prefetch GET /admin/history/export/?_rsc=... (the Export button is a Next Link to a file download route) never ends, so the page never reaches network idle; once Chromium reported "Page crashed" on this screen during the 19-screen walk.
- Screenshot: .relay/shots/e1/E1-C3-and-C4-history-rows-1440.png.
- Suspected file: src/app/admin/history/_view/HistoryView.tsx line 111 (an Export link that should be a plain download link with no prefetch).

### E1-C4 (Medium): city, category and SEO-template writes are audited without a role and without a summary
- Steps: create a city (Cities & areas, New place), a category (Categories, New category), save a title template (SEO center, Templates); read the audit log.
- Expected: each entry says who (with the role), what (a plain sentence) and when, like Prices, Users and Page builder do.
- Actual: the entries location.create, category.create and seo.template.save have the actor and the time but no actorRole and no summary or label, so History has nothing readable to show.
- Screenshot: .relay/shots/e1/E1-C3-and-C4-history-rows-1440.png.
- Suspected files: src/server/locations/manage.ts line 59 (`record()` calls audit.append with no actorRole and no summary), src/server/categories/manage.ts, src/server/seo/templates.ts. Fix: set actorRole and summary the way src/server/admin/write.ts does.
- Test: kept-out spec e1c-red-audit (3 tests).

### E1-C5 (Low): console error on the Page builder
- Steps: open /admin/page-builder/ and read the browser console.
- Expected: no console errors.
- Actual: three lines per load, "Framing 'http://.../' violates the following report-only Content Security Policy directive: frame-ancestors 'none'" (the builder's preview frame shows our own Home page). Report-only, so nothing is blocked today, but the preview would break the day the policy is enforced.
- Suspected: the CSP header (next.config.ts or src/proxy.ts) against the preview frame in src/app/admin/page-builder/.
- The new specs ignore exactly this one message (a commented line in tests/e2e/e1c-checks.ts) so the rest of those pages is still checked. They also ignore the browser's own "410 Gone" line for a removed ad page.

### E1-C6 (Medium): All ads has no tick boxes on a phone
- Steps: at 390 px open /admin/ads/ (the page text says "select several to pause, extend or remove").
- Expected: a way to select ads on a phone.
- Actual: the row tick boxes and the select-all box are in the page but hidden (`.adm-k-cbx, .adm-k-hide-phone { display: none !important }` in the phone rules), so nothing can be selected and the bulk Remove, Pause and Extend are unreachable on a phone.
- Screenshot: .relay/shots/e1/E1-C6-all-ads-phone-no-tick-boxes-390.png.
- Suspected file: src/styles/admin-kit.css line 305.
- The new remove / restore test skips itself on the phone project for this reason (the skip message names the bug).

## What every new spec checks on each page it lands on

One `<h1>`, no sideways scroll, no serious or critical axe problem (wcag2a, wcag2aa, 2.1 a and aa), no console error. The shared helper is tests/e2e/e1c-checks.ts.

## Files

- In the PR: tests/e2e/e1c-checks.ts, e1c-roles-core.ts, e1c-roles.e2e.ts, e1c-ads.e2e.ts, e1c-audit.e2e.ts, docs/ownership/H99.3.json, progress/E1-C.md, progress/E1-C-known-bugs.e2e.ts.txt
- Kept out of the PR (text only): the failing journeys in progress/E1-C-known-bugs.e2e.ts.txt

## How verified

- `npm run lint`: 0 errors (existing warnings only). `tsc --noEmit`: clean. `node .github/scripts/forbidden-terms.mjs`: 0 hits.
- New specs: 1440 7 passed (ads, audit) + 5 passed (roles); 390 2 passed + 1 skipped (ads) + 5 passed (roles).
- Known-red specs (E1-C2 spec removed, see above): roles 2 failed at both sizes (E1-C1); audit 3 of 3 failed (E1-C4).
