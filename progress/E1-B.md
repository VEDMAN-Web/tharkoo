# E1-B: Account, Seller and Buyer, full browser test (no product fixes)

Build: local production build (webpack) of main 6366c9f, in-memory Mongo with the normal seed, test payments on, no real Cloudinary, mail or payment calls. Playwright projects desktop-1440 and phone-390, 1 worker, ports 4460-4479. Never the real site or database.

## Step 1: the existing specs of my area (254 tests)
Specs run: account, account-home, account-pages, logout, session-refresh, advertiser, post-check-switch, post-fit, post-media, post-new-design, post-step-5, post-steps-1-2, post-steps-3-4, post-strip, my-ads, money, vendor-panel, a14-credits, a20-packs, a24-refund, user-panel, inbox-profile, contact-card, tour-call, tours-ui, h14-3-seller-dashboard, h11-1-prices, h13-1-staff-upload, h13-1b-photo-shrink.
Result: 224 passed, 28 skipped (each skip is a project-specific skip written in the spec, for example "desktop only"), 2 failed: account-home.e2e.ts:44 at both sizes (bug E1-B2, a stale test, not a product fault).

## Step 2: journey table
New specs: tests/e2e/e1-b-account, e1-b-post, e1-b-seller, e1-b-buyer, e1-b-money, e1-b-chat (19 tests per size, helpers in e1-b-helpers.ts). Each test also fails on a script error or console error, and ends on a page with one h1, no sideways scroll and no serious or critical axe problem (the chat journey checks only the h1, because of E1-B9). Those 19 tests ran 3 times in a row at both sizes: 114 of 114 passed, flaky rate 0 of 114.
The failing expectations are kept as evidence in progress/E1-B-known-bugs.e2e.ts.txt (a spec saved as text, outside the test folder, so it is not part of the PR). To run it, copy it to tests/e2e/e1-b-known-bugs.e2e.ts.

| Journey | desktop | phone | bug | spec |
|---|---|---|---|---|
| Sign up with an emailed code and land in the panel | PASS | PASS | | login-sheet (existing, passes) |
| Verify the email link (one use only) | PASS | PASS | | e1-b-account |
| Log in, log out, wrong password, rate limit | PASS | PASS | | account, logout (existing) |
| Forgot password, reset, old password refused, old session ended | PASS | PASS | | e1-b-account |
| Edit account (name) | PASS | PASS | E1-B3 (message) | e1-b-account |
| Delete account request (a support ticket, stops there, nothing deleted) | PASS | PASS | | e1-b-account |
| Post an ad end to end, normal category (Jobs), edit, pause, resume | PASS | PASS | | advertiser (existing) |
| Post an ad, people category (Dating): age required, 18 or over, adult consent, goes live | PASS | PASS | | e1-b-post |
| People category: no video | FAIL | FAIL | E1-B4 | known bugs |
| Free versus paid posting (first ad free, next one takes the fee) | PASS | PASS | | e1-b-post |
| Paid posting with no credits (amber pay card, recharge) | PASS | PASS | | e1-b-post |
| Delete an ad from My ads (two taps) | PASS | PASS | E1-B10 (question: no undo) | e1-b-seller |
| Boost with credits: Bump, TOP, Super Top | PASS | PASS | | e1-b-seller |
| Auto Boost, Flash | not in the product | | | the seed has Bump, TOP, Super Top only |
| Credits purchase on the test payment page, receipt, history | PASS | PASS | | e1-b-money |
| Coupon (credits once, second try adds nothing) | PASS | PASS | | e1-b-money |
| Identity check: send, staff approve, page says ID checked | PASS | PASS | E1-B8 | e1-b-money |
| Identity check: refused, page says send clear new photos | PASS | PASS | | e1-b-money |
| Saved ads on this device (heart, Saved ads, heart off) | PASS | PASS | | e1-b-buyer |
| Saved ads on a second device of the same account | FAIL | FAIL | E1-B6 | known bugs |
| Saved search alert: save, list updates, remove | FAIL | FAIL | E1-B5 | known bugs |
| Two accounts chat: send, receive, header unread badge, inbox unread row, reply seen without reload, block closes the composer for both | PASS | PASS | E1-B9 | e1-b-chat |
| Chat about an ad that was removed is read-only | FAIL | FAIL | E1-B7 | known bugs |
| Notifications: empty page, and the seller's page is not empty after a message | PASS | PASS | | e1-b-buyer, e1-b-chat |
| Seller dashboard numbers: owner visit counts 0, one buyer view and one click give 1 and 1 | PASS | PASS | | e1-b-chat |
| "Turn on live chat" step in Your profile points to Settings | FAIL | FAIL | E1-B1 | known bugs |
| Account home shows the Available now and Live chat switches (old test) | FAIL | FAIL | E1-B2 | account-home (existing) |
| Video call button and tours | PASS | PASS | | tour-call, tours-ui (existing) |
| Photos and videos page, support tickets, my ads, user panel | PASS | PASS | | account-pages, my-ads, user-panel, inbox-profile (existing) |

## Bugs
Screenshots are in .relay/shots/e1/.

**E1-B1** The "Turn on live chat" step in Your profile goes to the wrong page.
Steps: sign in as a seller with a live ad, open /u/account/dashboard/, find Your profile, click "Turn on live chat".
Expected: Settings, /u/account/edit-account/ (the switches live there now).
Actual: /u/seller-profile/.
File: src/lib/ui/profile-progress.ts line 19. Screenshot: E1-B1-turn-on-live-chat-link.png.

**E1-B2** account-home.e2e.ts:44 expects the Available now and Live chat switches on the account home; H14.3 moved them to Settings.
Steps: run tests/e2e/account-home.e2e.ts. Expected: the test checks the switches on Settings. Actual: it looks for `[data-tk="availability"]` on the home and fails at both sizes. The product is right, this is a TEST fix that keeps the meaning (switches present on Settings).
File: tests/e2e/account-home.e2e.ts line 57. Screenshots: E1-B2-account-home-1440.png, E1-B2-account-home-390.png.

**E1-B3** A raw developer message shows on Your profile.
Steps: sign in as a new account, open Settings, Name, Change (opens /u/seller-profile/), type a name, leave City on "Choose your city", Save and continue.
Expected: a plain sentence such as "Choose your city".
Actual: "Too small: expected string to have >=2 characters" under City plus "Please check the highlighted fields."
File: the seller profile form (the field error text comes straight from src/lib/ui/api.ts friendlyError / the schema message). Screenshot: E1-B3-raw-validation-message.png.

**E1-B4** (safety) A seller can save a video on a people (Dating) ad.
What the seller path does TODAY, measured on the local server with the watermark switched off in the test database (the test server has no Cloudinary and keeps the watermark on, which refuses every video for another reason):
1. The post flow (Photos step) of a Dating ad shows the "Add video" button and the video input (src/components/post/PhotoStep.tsx, no people check). The edit flow uses the same step.
2. POST /api/media/sign with kind "video" and the Dating draft's id answers 200 mode "local". `signMedia` calls `assertVideoAllowed`, which only checks the file type and size, ownership and room; there is no people check (only src/server/media/staff-upload.ts and the video tours service have one).
3. POST /api/media/local with an mp4 then answers 200 `{status: "cleared", url: "/uploads/<id>.mp4"}`; the media asset is stored with kind video, status cleared and the Dating draft's listingId.
With Cloudinary in production the path is the same function (`signMedia`, then `completeMedia`/`completeVideo`), so the same rule is missing there. So the server accepts it; the UI also offers it. Scope question for Opus: #335 said the locked People rule is about live video tours and calls and not about uploaded clips; the product text says "Video is never allowed on listings about people" (src/lib/category-kinds.ts VIDEO_NEVER_FOR_PEOPLE) and staff uploads refuse it (STAFF_PEOPLE_NO_VIDEO).
Files: src/server/media/service.ts (signMedia, assertVideoAllowed), src/components/post/PhotoStep.tsx. Screenshots: E1-B4-dating-add-video-button.png, E1-B4-server-accepts-video-on-dating-ad.png.

**E1-B5** Save search on Saved search alerts throws a script error and the list does not update.
Steps: open /u/account/alerts/, type "yoga", pick Wellness and Mumbai, press Save search.
Expected: the search appears in the list, no error.
Actual: the browser reports "Cannot read properties of null (reading 'reset')", the page keeps saying "No saved searches yet"; the search is saved (a reload shows it) so a person may save it twice.
File: src/components/buyer/AlertsPanel.tsx line 60 (`event.currentTarget.reset()` runs after an await, when currentTarget is already null). Screenshot: E1-B5-save-search-list-not-updated.png.

**E1-B6** Saved ads belong to the device, not to the account.
Steps: sign in on browser A, press the heart on a listing; /api/saved/ lists it. Sign in with the same account on browser B, open /u/account/saved/.
Expected: the ad is listed ("1 saved").
Actual: "Nothing saved yet" (page says "1 saved on this device" on browser A, it reads local storage only). The Saved ads page also has no way to take an ad off the list.
File: src/components/buyer/SavedPanel.tsx (reads local storage only). Screenshots: E1-B6-saved-ads-other-device-a.png and -b.png.

**E1-B7** A conversation about an ad that is no longer live can still be written to.
Steps: a buyer chats with a seller on a live ad; the seller deletes the ad (two taps); the buyer opens the thread in Chats.
Expected: read-only (the composer is closed with a sentence), as for a blocked thread.
Actual: the message box is enabled; the server (`sendMessage`) only checks the "blocked" flag, and a new chat on a removed ad is refused with "This ad is not open for chat".
Files: src/components/chat/ChatThread.tsx (closed only follows `blocked`), src/server/chat/service.ts. Screenshot: E1-B7-removed-ad-chat-writable.png.

**E1-B8** Settings keeps saying the identity check is "Needed for some categories" after staff approved it.
Steps: send the ID photos on /u/account/kyc/, staff approve, open /u/account/edit-account/.
Expected: the Identity check row shows it is done.
Actual: the KYC page says "ID checked", the Settings row still says "Needed for some categories" with a View button.
File: src/components/buyer/SettingsPanel.tsx (setting-id row). Screenshot: E1-B8-settings-identity-after-approval.png.

**E1-B9** Colour contrast in the chat thread (serious axe problem).
Steps: a seller replies in a thread and blocks it; run axe on the thread.
Expected: no serious problem. Actual: color-contrast on `div[role=log] > div:nth-child(2)`.
File: src/components/chat/ChatThread.tsx message styles. Screenshot: E1-B9-chat-thread-contrast.png.

**E1-B10** (question, not a bug yet) Deleting an ad from My ads has no Undo.
The E1 plan says "delete + undo". The seller gets "Tap again to delete" and then "Deleted." with no Undo; Undo exists only in the admin. Does Opus want an Undo for sellers?

## Notes
- The first test of a fresh server sometimes fails on a cold start (the server compiles on the first visit); the table above comes from runs after warm-up and the 3-repeat run.
- Existing known red, not touched: h7-104-home "photos swipe by themselves ... pause after a click" fails on untouched main.
- The delete-account journey is safe on any account: the request only opens a support ticket.
- Mail is mocked: the verify and reset tests plant the token the mail would carry (the server stores only its hash).
