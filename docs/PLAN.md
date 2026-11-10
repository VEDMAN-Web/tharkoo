# Tharkoo — plan (Karpathy + SEO first)

Product name: **Tharkoo**. Owner: SparkBeta Tech.

This file is the source of truth for any Cursor account that continues the work. Quote PRD IDs in commits.

## Assumptions (do not silently change)

1. **Layout replica, original brand.** Match the classifieds IA, URL grid, card variants, and screen flow from `docs/prd/`. Do not copy another brand's logos, colours, photos, listing text, or trademarks. Appendix D says the look is original via design slots.
2. **Neutral catalogue.** Seed categories are the allow-list in `src/data/catalog.ts` (dating, friendship, meetups, personal ads, jobs, wellness, property, vehicles, buy and sell, pets, education). Rename there and re-seed. Do not add disallowed commercial categories.
3. **Stack (confirmed 9 Nov 2026):** Next.js (App Router) + Node.js + MongoDB. **Vercel** hosts the Next.js app (public URL). **DigitalOcean** hosts MongoDB (Managed Database). No separate Express server — Route Handlers in this repo talk to Mongo.
4. **No secrets required to run locally.** Docker Mongo or in-memory Mongo. Seed data is committed.
5. **P0 public browse is slice 1.** Vendor wallet, KYC, payments, Admin, bump scheduler come after the SEO page grid works.

## SEO-first (PRD §17) before extra features

Money pages are the auto-generated grid:

| Page | URL | Index |
| --- | --- | --- |
| Home | `/` | yes |
| Category hub | `/{category}/` | yes |
| Category + state or city | `/{category}/{location}/` | yes (noindex if &lt; 3 live ads) |
| Category + district | `/{category}/{city}/{district}/` | yes (same thin rule) |
| Ad | `/ad/{title-slug}-{publicId}/` | yes while live; **410** when deleted |
| Search | `/search/?…` | **noindex** |
| Vendor `/u/*` | private | **noindex** |

Every listing/ad page: SSR, self-canonical, BreadcrumbList, ItemList or Offer JSON-LD, crawlable `?page=n` even if the UI infinite-scrolls.

Footer legal links may use `data-href` later (PUB-FTR-002). Slice 1 uses normal links so the replica is usable.

## Slice 1 — done when

1. `docker compose up -d` **or** `npm run dev` (memory Mongo) starts the site.
2. Home shows one block per seeded category, each linking its top cities.
3. City listing pages render ranked cards (Free / Top / Super Top / Highlight / Flash / Star).
4. Ad pages render gallery, attributes, contact buttons, related ads, report link.
5. 18+ gate + cookie banner.
6. `/sitemap.xml` and `/robots.txt` exist.
7. Another person can clone the repo, follow `README.md` + `docs/HANDOFF.md`, and keep going.

## Later slices (do not start until slice 1 is accepted)

- **Slice 2 — Vendor P0:** register/login, KYC stub, dashboard, 3-step post wizard, media albums, ad list (PRD §6–9).
- **Slice 3 — Money P0:** credits wallet, Top/Flash/Star, bump scheduler job, coupons (PRD §10–12).
- **Slice 4 — Admin P0:** catalogue, SEO templates, moderation, RBAC (PRD §15).
- **Slice 5 — Trust/support:** reports queue, help centre CMS, grievance (PRD §14, 16).

## Karpathy checks on every PR

- Touch only the files for the current slice.
- No extra abstractions “for later admin”. Catalogue is Mongo documents, not a plugin system.
- Success = a URL a human can open, plus a seed command that fills it.
