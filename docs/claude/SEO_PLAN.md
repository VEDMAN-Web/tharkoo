# Tharkoo — SEO plan v1 (Opus, 11 Nov 2026)

Order of work, as Vedant asked: **1. SEO analysis** (done: FINDINGS.md; Haiku re-verifies in H0.0) → **2. SEO planning** (this file; v2 after keyword data in H2.1) → **3. fixes** (TASKS.md: H1 technical now; H4 SEO center in the admin; H5 content/IA after the gate). Admin + dynamic pages: ADMIN_PLAN.md (H3).

## 1. Decisions Vedant must make before Phase H5 (content) and H6 (design)

Technical fixes (H1), the admin/dynamic pages (H3) and the SEO center (H4) do not depend on these and go first. Because every text and image becomes admin-editable, most positioning answers become admin content changes, not code.

| ID | Decision | Opus recommendation | Why |
|---|---|---|---|
| D1 | What does Tharkoo lead with? **DECIDED 11 Nov: nothing. Neutral placeholder site; Vedant curates categories and content himself in the admin.** | **Property, vehicles, jobs, buy & sell** as the core; pets, education, services next; friendship/meetups as a small community section; dating kept but not on the hero; **remove "wellness – spa, massage"** (or rename to "Fitness & classes" with no spa/massage wording). | Matches your goal (cars + property). Real search demand, lower spam risk, payment gateways accept it. |
| D2 | Keep the name "Tharkoo"? | Decide now. Sounds like "tharki". If kept, avoid dating-first positioning. | Brand searches, trust, partners. |
| D3 | Where do we launch? | **Gujarat first**: Surat, Ahmedabad, Vadodara, Rajkot (+ Gandhinagar). Add Mumbai/Pune/Bengaluru later. | You are in Surat and can seed real listings; big portals are weaker in tier-2 long tail. |
| D4 | Domain | Confirm the domain you own; DNS + HTTPS before any indexing. | Nothing ranks without it. |
| D5 | Design | **Drop the copied reference layout** (CLONE_SPEC) and the site-wide 18+ age gate; age gate only on dating/personal sections. New design brief from Opus in H6. | Current look says "adult site". |
| D6 | Keyword volumes | Optional: a small pay-as-you-go DataForSEO balance so the Open SEO keyword skill returns real volumes. Without it we use SERP evidence only. | Better prioritisation. |

## 2. Where Tharkoo can realistically win

Head terms ("flats for rent", "used cars", "jobs") belong to OLX, Quikr, MagicBricks, 99acres, Housing, NoBroker, CarDekho, Cars24, Naukri, Indeed, Apna. A new domain will not beat them in year one. We win on:

1. **Long tail × city × sub-category**: "1 bhk flat for rent in adajan surat", "second hand activa in surat", "jobs for freshers in surat", "labrador puppy for sale in ahmedabad". Many of these SERPs show thin portal pages or Facebook groups.
2. **Tier-2/3 cities and localities** (Gujarat first) where portals have little real inventory.
3. **Google Jobs** via complete `JobPosting` structured data (free placement for every real job ad).
4. **Freshness**: dated, real, local ads with photos and prices; visible "updated" dates.
5. **Answer engines**: clean `llms.txt`, factual hub summaries with real counts and price ranges.

## 3. Target site architecture

```
/                              home: category grid + city picker + latest ads in visitor's city
/{category}/                   category hub (India)
/{category}/{city}/            MONEY page: category × city
/{category}/{city}/{sub}/      NEW MONEY page: sub-category × city  (e.g. /property/surat/flats-for-rent/)  ← designed in H5
/{category}/{city}/{district}/ locality page, indexable only with ≥ 10 real ads
/ad/{slug}/                    ad page (indexable only when real, complete, active)
/cities/  /categories/         directories
/blog/  /help/                 support + topical content
```
URL rules: lowercase, hyphens, trailing slash, one canonical per page, all builders through `src/lib/urls.ts` (already true). Sub-category pages reuse the existing tag/attribute data; exact URL design is decided in H5 after keyword data, so no URL is changed in Phase H1.

## 4. Indexing policy (what Google may index)

| Page | Index when | Otherwise |
|---|---|---|
| category × city | ≥ 3 real active ads (existing rule) | noindex, follow; out of sitemap |
| sub-category × city | ≥ 5 real active ads | noindex, follow; out of sitemap |
| district | ≥ 10 real active ads AND district ≠ city alias | alias → 308 to city hub; else noindex |
| ad | real (not demo), active, title ≥ 20 chars, description ≥ 40 words, ≥ 1 own photo | noindex, follow |
| expired ad | 200 + noindex + "ended" banner ≤ 30 days, then 410 (existing) | — |
| search, filters, page ≥ 2 | never (existing: noindex, follow) | — |
| demo data | never; demo ads are deleted before launch | — |

## 5. On-page rules (every template; enforced by `scripts/seo-check.mjs`)

- `<title>` 30–65 chars, unique, keyword first, brand last: `Flats for rent in Surat – 1, 2, 3 BHK | Tharkoo`.
- Meta description 70–160 chars, unique, includes a real number (count or price range) when available.
- Exactly one `<h1>`, contains the main keyword, not repeated text.
- Title, description, canonical and robots meta **in `<head>` in the first HTML** for every user agent.
- Intro copy (editable in admin: templates H4.3, per-URL overrides H4.4): unique facts per page (count, price range, top localities, newest date), written for people. No swapped-word templates once real data exists.
- Images: alt = what the photo shows (from ad title + category), never empty on content images.
- Internal links on every money page: parent category hub, sibling sub-categories in the same city, same category in 6 nearby cities, top localities.

## 6. Structured data by page type

| Page | JSON-LD |
|---|---|
| Home | WebSite + SearchAction, Organization (exists) |
| Hubs | BreadcrumbList, ItemList of ad URLs (exists); FAQPage only when FAQ text is visible and page-specific |
| Job ad | **JobPosting** with title, description, datePosted, validThrough, employmentType, hiringOrganization, jobLocation (address), baseSalary when given. Omit when a required field is missing (exists as rule; verify) |
| Property ad | BreadcrumbList + `RealEstateListing`-style WebPage data; **no Product/Offer** |
| Vehicle / buy & sell ad | Product + Offer only with a real price; else BreadcrumbList only |
| Dating / personal | BreadcrumbList only (exists) |
| Blog | BlogPosting (exists) |

## 7. Technical baseline (Phase H1 — starts now)

H1.1 robots.txt · H1.2 metadata always in `<head>` · H1.3 crawler-safe rate limiting · H1.4 same-name district duplicates · H1.5 home H1 dedupe · H1.6 titles/descriptions lengths and grammar. Target after H1: `seo-check` P0 = 0 and robots issues = 0 on a fresh local production server.

## 8. Measurement

- `node scripts/seo-check.mjs` after every SEO-touching task (P0 must stay 0); from H4.1 the same rules run nightly inside the admin (SEO overview).
- After launch: Google Search Console + Bing Webmaster Tools (sitemap submitted, coverage, queries), IndexNow on publish.
- KPIs first 90 days: indexed money pages, impressions on "{sub-category} in {city}" queries, clicks to ad pages, contact reveals per visit, real ads posted per city.

## 9. What changes in v2 (after H2.1 keyword evidence + decisions D1–D6)

Opus will add: the keyword → URL map per launch city, the sub-category list and URL pattern, title/H1/description templates per category (entered through the H4.3 templates editor), hub copy rules, and the H5 (content/IA), H6 (design) and H7 (launch) task cards.

## 10. Ahead-of-the-race additions (v1.1, 11 Nov 2026 — committed scope, not optional)

| # | Addition | When | How |
|---|---|---|---|
| A1 | **Gujarati + Hindi pages** for launch-city hubs with real listings | after launch content (H5+) | `/gu/…` and `/hi/…` prefixes, hreflang `en-IN` / `gu-IN` / `hi-IN` / `x-default`, translated SEO templates (H4.3) and UI text keys (H3.7 dictionary makes this a data job, not code). Only pages that already pass the indexing rules get a translation. |
| A2 | **Title A/B testing** on top hubs | after launch, once Search Console has ≥ 28 days of data | SEO center: variant B for a URL group, 28-day CTR comparison from Search Console, keep the winner. Never test on pages with < 100 impressions/week. |
| A3 | **Low-end Android performance budget** | every public-page task from H3.4 on, enforced in H6 | Lighthouse mobile (Moto G-class throttling) ≥ 90 on home, hub, ad; LCP ≤ 2.5 s; CLS ≤ 0.05; public-page JS ≤ 170 KB gzipped; card images ≤ 60 KB, hero ≤ 150 KB (AVIF/WebP); a CI script fails the build over budget. |
| A4 | **Cloudflare (free) in front of the server** | launch (H7) | CDN for static files and images, HTTPS, WAF + bot rules that allow verified search bots, page rules never caching `/u/`, `/admin/`, `/api/`. |
| A5 | **Google Jobs + Indexing API** | H4.7 + H7 | Complete `JobPosting` (title, description, datePosted, validThrough, employmentType, hiringOrganization, jobLocation, baseSalary when given). Google's Indexing API is officially allowed for job pages: ping it on publish/expire so job ads appear in hours, not weeks. |
| A6 | **Real inventory before indexing** | before launch (business task + one code card H3.10) | 20–50 genuine ads per launch category in Surat first (brokers, car dealers, job agencies, coaching classes). H3.10: admin **CSV bulk import** for verified partner accounts (validated, moderated, photos by URL from the partner's own uploads), so a partner's 30 listings go live in one step. |
| A7 | **Freshness signals** | exists + H4.6 | Visible "updated" dates, sitemap `lastmod`, IndexNow (Bing/Yandex) on publish, expired ads → noindex then 410. |
| A8 | **Share-driven traffic** | H6 | WhatsApp share on every ad and hub (India's main sharing channel), clean OG cards per category and city. |
| A9 | **Local backlinks** | from launch (non-code, Vedant's team) | Surat/Gujarat business directories, local news and community sites, college placement cells for jobs, dealer and broker partner sites linking to their Tharkoo listings. |
| A10 | **Hub copy from facts, not filler** | H4.3 / H5 | Each hub shows its own live numbers: count, price range, top localities, newest-ad date. No swapped-word templates. |
