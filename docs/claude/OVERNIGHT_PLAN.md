# Tharkoo — Overnight finish plan (Opus, 12 Nov 2026, 02:10 IST)

Vedant is asleep until about 10:00 IST. Goal by then: everything built, working, looking right on phone, tablet and desktop, and tested end to end.
Opus checks the relay about every 45 minutes, reviews each phase, and sends one batched fix list per phase. Model: Sonnet for everything tonight.

## Rules for tonight (on top of CLAUDE.md)
- Phase mode as in message #17: one branch and PR per part. Merge each part yourself once local checks pass and all 7 CI checks are green. Merging requires Vedant's own go-ahead given in YOUR chat. If a merge is refused anyway, leave the PR open with green CI, keep working, and list it in the phase report. Never push to main directly, never force-push.
- After every commit, check the relay (rule from #16). Opus fix lists come in between phases and have priority over new parts.
- Every merge to main also deploys https://tharkoo.vercel.app automatically (Vercel is linked to the repo). After each merge, check that the Vercel build succeeded (`npx vercel@latest ls tharkoo --scope sbt610` or the GitHub commit status), and that `/` returns 200 there. A failed Vercel build is a P0: fix it first.
- Quality over the clock. If a part overruns its time slot by more than 50 %, append one line `LATE <id> <reason>` and keep going. Do not skip acceptance checks to catch up.
- Never store or print secrets. Never point tests, ui-smoke or local-prod at the Vercel database.
- Stop and append a QUESTION only for: deleting data, auth or role logic, money, what visitors see in contact info, or anything needing Vedant's accounts. Otherwise decide sensibly, note it, and continue.

## Timeline (IST) and deadlines
| By | Work |
|---|---|
| 02:45 | **Open PRs:** finish and merge #54 (one ListingPin model and collection only; migrate nothing, the data is demo) and #55. |
| 03:15 | **OPS: Vercel data** (message #24). Try `npx vercel@latest whoami`. If it is already logged in, do #24's steps. If a browser login is needed (Vedant is asleep), use plan B: part **H0.6**, a one-time demo seed route. `POST /api/ops/seed-demo` runs `runSeed()` only when ALL of these hold: env `ALLOW_DEMO_SEED=true`, the categories collection is EMPTY, and `SITE_NOINDEX=true`. Otherwise it returns 404. Rate limit 1 per 10 minutes, audited, idempotent, with tests. Opus sets `ALLOW_DEMO_SEED=true` in Vercel and calls the route, then sets the flag back to false. Append `OPS READY seed-route` when merged. |
| 05:00 | **Phase 3 rest, part 1:** H3.4 (home page fully from blocks, neutral placeholder defaults per ADMIN_PLAN §8) and H3.5 (listing pages from blocks). |
| 07:00 | **Phase 3 rest, part 2:** H3.6 (post-ad page blocks + category post-fields editor) and H3.7 (UI text dictionary). |
| 08:00 | **Phase 3 fixes (H3.11),** one PR:<br>(a) hidden ads (`feedHidden`) excluded from sitemaps, search, "More like this" and every other public list, not only feeds;<br>(b) add a real `price` (number, INR) field to listings that the post form, cards, ad page, CSV import and JSON-LD use. Do NOT loosen the attribute deny-list; price is a first-class field, not an attribute;<br>(c) a media storage adapter: when the `CLOUDINARY_*` env vars are set, H3.3 site media and listing photos upload to Cloudinary; otherwise local disk (dev only). On Vercel without Cloudinary, the admin upload screen shows a clear notice "Image upload needs Cloudinary on this server" instead of failing silently;<br>(d) district picker for pins;<br>(e) imports that go straight to active trigger IndexNow like normal publishing.<br>Then **=== PHASE DONE 3 ===**. |
| 12:00 | **Phase 4 (SEO center):** H4.1 → H4.7 exactly as the cards say. Then **=== PHASE DONE 4 ===** (include seo-check P0 and P1 on an indexable local build; target P0 = 0). |
| 15:00 | **Phase 5 (H5.1): end-to-end test and polish,** below. Then **=== PHASE DONE 5 ===**. |

## H5.1 — End-to-end tests and final polish
Files: `tests/e2e/**`, `playwright.config.ts`, `scripts/**`, plus small fixes anywhere the tests find bugs. Split fixes into their own PRs, named H5.1a, H5.1b and so on, with ownership entries.
Playwright e2e on a local production build (local-prod, in-memory Mongo), each journey at 390 and 1440. Add `npm run test:e2e`. Journeys:
1. **Visitor:** home → category card → category feed → city page → filter (verified, with photos) → page 2 → ad page → swipe the gallery, open the lightbox → contact reveal (number absent from the initial HTML, present after the click) → share copy-link → report form.
2. **Search:** pop-up opens and searches by text, city and category; empty result state; the search page is noindex.
3. **Account:** register (auto-verify on staging flags) → login → dashboard cards → edit profile → logout. Wrong password 6 times → 429.
4. **Advertiser:** login → KYC upload → admin approves KYC (API in test) → post-ad 3 steps with photos → publish → pending → admin approves → visible on the city page and ad page → edit → renew → pause.
5. **Money (mock):** buy credits (mock provider) → apply TOP → the ad ranks first on its city page → coupon error states.
6. **Admin:** login → dashboard numbers equal DB counts → home page editor: change hero text, swap image (media library), reorder, hide, publish → visible on / → restore the previous version → listing pages editor scoped to one category → post-page labels → UI text edit → listing order: pin an ad to position 1 → it shows first; hide an ad → gone from feeds and the sitemap → CSV import dry run + import → moderation queue.
7. **SEO center:** run the check → issues table → change a template → titles change → a per-URL override → a redirect + the 404 monitor → indexing toggle for a city → that city is noindex and out of the sitemap → robots and llms settings.
8. **Roles:** a normal user gets 403 on every /admin route and /api/admin call; a seo_editor sees only the SEO group.
Plus:
- **axe accessibility:** 0 serious or critical issues on home, listing, ad, register and the admin dashboard.
- **Lighthouse mobile:** ≥ 90 performance, ≥ 95 accessibility and SEO, on home, listing and ad.
- **Visual:** no horizontal scroll and no overlap (ui-smoke) at 390, 768 and 1440 on every public page and every admin screen.
- **Security sweep:** no phone, WhatsApp or Telegram values in any HTML, RSC or JSON response before the reveal; admin pages noindex; the origin check on all POSTs; no secrets in client bundles (search `.next/static` for MONGODB, SECRET and KEY).
- **Vercel smoke** (read-only): `/`, a category, a city, an ad, `/admin/login/`, `/robots.txt` and `/sitemap.xml` return the expected status on https://tharkoo.vercel.app.
- **Report:** PHASE DONE 5 with each journey PASS/FAIL, the axe and Lighthouse numbers, the bugs found and fixed (PR numbers), and anything still open.
