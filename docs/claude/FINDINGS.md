# Tharkoo — R&D and SEO findings (Opus, 11 Nov 2026, main @ 792aa9e)

How this was measured: fresh clone of `main`, production build (`next build` + `next start`), in-memory MongoDB with the repo seed (11 categories, 120 locations, 8,228 demo listings), a full crawl of all 719 sitemap URLs with a Googlebot and a normal-browser user agent (`scripts/seo-check.mjs`), internal-link check from 10 key pages (268 links), and screenshots at 1440 px and 390 px. Haiku reproduces this in task H0.0.

Severity: **P0** blocks good indexing or is a real bug · **P1** hurts rankings/UX noticeably · **P2** polish.

## A. What the codebase is today (short)

- Next.js 16.4.5 App Router + React 19 + Mongoose 9 + Tailwind 4, single Node process, MongoDB. 60 pages with metadata, ~25 API route groups, 174 unit tests, CI (lint, typecheck, test, build, gitleaks, ownership-check, forbidden-terms).
- Backend is real: auth with sessions, KYC (manual), media (Cloudinary or local disk), listings with status machine, wallet/credits/promotions (mock payments), search, URL/slug manager with 301s, admin CMS for homepage, menus, landings, tags, SEO overrides.
- SEO engine exists: per-URL overrides, title/description templates, sitemap index with 6 shards, thin-hub noindex (< 3 ads city, < 10 district), demo ads `seoNoindex`, JSON-LD (WebSite, Organization, BreadcrumbList, ItemList, FAQPage, Product/JobPosting/BlogPosting), `llms.txt`, IndexNow helper, `SITE_NOINDEX` switch.
- Layout and wording were deliberately copied from a competitor reference (`docs/design/CLONE_SPEC.md`, branch `cursor/t9.1-reference-site-replica`). That reference is an adult-services classifieds site. This is the main reason the site looks and reads wrong for property, vehicles and jobs.
- Not deployed. `143.244.141.17` (the droplet named in MASTER_PLAN) currently serves a different app. No domain is live (`tharkoo.com` has no DNS per docs).
- `PROGRESS.md` is stale (shows T1.1 in progress; everything through T9.7 is merged).

## B. Technical SEO findings

| # | Sev | Finding | Evidence | Fix task |
|---|---|---|---|---|
| B1 | P0 | **robots.txt per-bot groups cancel the Disallows.** Googlebot, Bingbot, OAI-SearchBot, PerplexityBot and Claude-SearchBot each get their own group with only `Allow: /`. Crawlers obey only their most specific group, so they may crawl `/u/`, `/admin/`, `/api/`, `/search`. | `src/app/robots.ts`; seo-check: 15 robots issues | H1.1 |
| B2 | P0 | **Title, description, canonical and robots meta are streamed into `<body>` on every uncached render.** Next 16 "streaming metadata" treats Googlebot as JS-capable and streams; on a cache miss (hubs revalidate every 60 s) none of these tags are in `<head>`. Google must render JS to see the canonical/noindex rules this site depends on. | 735 of 1,448 requests (both user agents): "title only in body", "no canonical in head". Opus trial: `htmlLimitedBots: /.*/` in `next.config.ts` → 0 of 1,448, cold TTFB still ~40–60 ms locally | H1.2 |
| B3 | P1 | **Rate limiter can throttle Google and is easy to bypass.** Every page view counts toward 240/min per IP (Mongo write per request). The key is the *first* `X-Forwarded-For` value, which any client can set, so scrapers bypass it while a busy crawler IP can get 429 JSON with no `Retry-After`. My plain crawl got 320 × 429 after ~400 pages. | `src/proxy.ts` L88–103, `src/lib/rate-limit.ts` `clientKey` | H1.3 |
| B4 | P1 | **Duplicate hubs: city page = same-name district page.** e.g. `/jobs/kolkata/` and `/jobs/kolkata/kolkata-district/` have identical title and H1 (Chennai, Hyderabad too). | seo-check: 100 duplicate-title rows, 104 duplicate-H1 rows | H1.4 |
| B5 | P1 | **Home H1 says the slogan twice and has no keyword.** H1 text = "Single? Taken? Doesn't matter, Tharkoo is for everyone" repeated (desktop and mobile variants both inside the H1). | `src/app/page.tsx` L35–45 | H1.5 (dedupe now), H3.4 (admin-editable) |
| B6 | P1 | **Weak/short titles and descriptions.** Category hubs: "Jobs ads in India \| Tharkoo" (27 chars, bad grammar), desc "Browse Jobs listings across Indian cities." (44 chars). 38 titles < 30 chars, 30 descriptions outside 70–160. | seo-check P1 | H1.6 |
| B7 | P1 | **Hub copy is template boilerplate.** Intros are built from 3 openers × 3 extras with city/category swapped (`src/lib/seo/landing.ts`). 700+ near-identical pages = "scaled content" risk under Google's spam policies once indexed. FAQs follow the same pattern. | read of `landing.ts` | H4.3 templates + H5 copy |
| B8 | P1 | **Index is built on demo data.** All 649 city hubs pass the "≥ 3 ads" rule only because of seeded demo ads. With real data at launch, almost every hub is thin. Launch needs a city/category scope that real inventory can fill. | sitemap counts: categories 11, cities 649, districts 33, ads 0 | D3 decision + H4.6 + H7 |
| B9 | P2 | Ad JSON-LD uses `Product` for property ads; Google treats `Product` + `Offer` as merchant listings (expects shipping/returns). Jobs need complete `JobPosting` to reach Google Jobs, a major Indian traffic source. | `src/lib/seo/schema.ts` L74–115 | H4.7 |
| B10 | P2 | Help, blog and a few legal pages are 94–141 words. Fine for help, weak for blog. | seo-check thin list | H5 |
| B11 | P2 | `next start` warns that `output: "standalone"` should run with `node .next/standalone/server.js` (deploy concern only). | build log | H7 |

What is already good (keep): one H1 on 99% of pages, self-canonicals, `?page=N` handling, 404/410 logic, sitemap shards with lastmod, thin-hub noindex, no contact numbers in HTML, alt text on all images, 0 broken internal links in the 268 checked, Lighthouse (from T9.1) 92–98 mobile performance.

## C. Design / UX findings (screenshots 1440 + 390)

1. Home is a dating site: hero woman photo + "Single? Taken?" slogan; the 5 home category cards are Dating, Wellness ("spa, massage"), Friendship, Meetups, Personal ads. Property, vehicles, jobs, buy & sell, pets and education are not on the home page at all.
2. "Latest ads" on home is broken on desktop: not in the page container (starts at x = 0), 2 columns that leave the right third empty, and it shows random far-away cities (Puducherry, Kavaratti, Leh) instead of the visitor's city.
3. City listing pages (e.g. Property in Surat): cards have **no photo, no price, no key facts** (BHK, km, salary). Titles repeat ("Plot for sale in Surat" × 5). H1 is visually tiny. No category filters (price, BHK, fuel, experience) — only "Verified" and "With photos".
4. Ad page: no price block, raw tag chips ("kind: House", "purpose: Sale"), dating-site wording on a property ad ("Contact me", "People arrange meetings on their own"), gallery leaves an empty quarter.
5. Every page shows an 18+ age gate, including property and jobs. That is the adult-site pattern from the reference; it hurts every non-dating visitor and adds a modal before content.
6. Overall: the visual language (plum/rose, portraits of women, age gate, "meet" wording) tells Google, payment gateways and visitors "adult/dating site". For a property/vehicles/jobs classifieds that is the single biggest problem.

## D. Business and risk findings (need Vedant's decision — see SEO_PLAN.md §1)

- **Positioning conflict.** Vedant's goal (per Opus notes): car and property classifieds. The repo leads with dating/wellness. Pick one lead.
- **Category risk.** "Wellness: spa, massage" and "dating/meetups/personal" in India's classifieds space are the categories most abused for disguised sexual-service ads. Ranking for "massage in {city}" means competing with spam networks and attracting them as advertisers. Google SafeSearch, Razorpay/Cashfree and Cloudinary policies all react to this.
- **Brand name.** "Tharkoo" sounds almost the same as Hindi slang "tharki" (lecherous person). With dating categories this will read badly to Hindi-speaking users and partners. Worth deciding before any domain, logo or backlink work.
- **Copied layout and wording** from the reference site (CLONE_SPEC §0.1 rule 2) is a legal and brand risk, separate from SEO.
- **No domain / no deploy.** Nothing can be indexed yet. Good: we have time to fix the foundations first.

## E. Admin panel findings

- ~35 admin pages, most are a generic JSON `CollectionEditor` over a Mongo collection ("Translations" is literally the `Page` collection). Navigation is a flat list of 17 links; no dashboard numbers that match the new data model (`status: "live"`, `kind: "city"` → always 0).
- Home page is partly editable (`Site.homepage.content`: hero text, 5 cards, city groups, header/footer, age/cookie copy) but with a fixed shape: no adding/removing/reordering sections, no image library, no draft/preview/publish, no revisions.
- Listing pages and the post-ad page are not editable at all (strings in components). Category post-form fields exist in the data model but have no proper editor.
- Listing order is fixed in code (`src/server/ranking/score.ts`: tier → verified → freshness); no pins, no hide.
- SEO admin exists in pieces (URL manager with per-URL title/description/noindex, landings, tags, SEO templates via generic editor) but no audit view, no SERP preview, no counters, no indexing rules, no 404 monitor.
- Plan: `ADMIN_PLAN.md` (H3 admin + dynamic pages, H4 SEO center), Playzoni admin as the visual model.
