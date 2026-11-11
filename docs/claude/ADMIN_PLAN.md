# Tharkoo — Admin panel + dynamic pages spec (Opus, 11 Nov 2026)

Owner's words: *"From all the images to all the text placements to all the text on the page, I should be able to change them, delete them — CRUD on everything — on the home page, the ads listing page and the ad posting page, from the admin panel. I can even control the listings order. Make the admin like Playzoni's. Focus heavy on SEO in the admin."*

This file is the single source for phases **H3 (admin + dynamic pages)** and **H4 (SEO center)**. Task cards are in `TASKS.md`.

## 1. What "dynamic" means (the rule every card follows)

On the three pages — **Home** (`/`), **Listing pages** (`/{category}/`, `/{category}/{city}/`, `/{category}/{city}/{district}/`, sub-category pages later), **Post an ad** (`/u/post-insert/`) — **no text, image or section is hard-coded**:

1. **Sections** are *blocks* stored in MongoDB. Admin can add, edit, hide/show, reorder (drag + up/down buttons), duplicate, delete, and schedule (start/end date) any block, and choose phone-only / desktop-only.
2. **Every visible string** (headings, buttons, labels, placeholders, empty states, helper text, error text) is either a block field or a **UI text** key editable in admin. Code keeps a default for each key so the site never shows a blank.
3. **Every image** is picked from the **Media library** with required alt text; desktop and phone images can differ.
4. **Edits are safe**: Save draft → Preview (the real page with the draft, staff only) → Publish. Every publish keeps a revision; "Restore" any old version. Every change goes to the audit log (who, when, before, after).
5. **Listing order** is controllable: promotion tier order, verified-first and photo-first switches, manual pins per page (position + dates), hide/demote an ad from feeds. Defaults reproduce today's order exactly.
6. Publishing clears the page cache instantly (cache tag `layout:<page>`), so changes are live within seconds.

What stays code (not admin): the page skeleton and SEO tags' placement, security rules, the posting logic (validation, KYC gate, payments). Admin edits the *words, images, sections and order*, not the logic.

## 2. Data model (Mongo, `src/server/models/layout.ts`)

```ts
export type PageKey = "home" | "listing" | "post";

export interface BlockBase {
  id: string;                 // nanoid-like, stable; generated server-side (crypto.randomUUID())
  type: BlockType;            // see §3
  visible: boolean;
  label?: string;             // admin-only name shown in the editor list
  devices?: ("mobile" | "desktop")[]; // empty/undefined = both
  startsAt?: string | null;   // ISO; block shows only inside the window
  endsAt?: string | null;
  props: Record<string, unknown>; // validated by the block's zod schema
}

export interface PageLayoutDoc {
  key: PageKey;
  scope: string;              // "default" | "category:<slug>" | "url:<path>"   (listing pages use scopes)
  draft: BlockBase[];
  published: BlockBase[];
  version: number;            // +1 on every publish
  updatedBy: string; updatedAt: Date;
  publishedBy: string; publishedAt: Date | null;
}
// unique index { key: 1, scope: 1 }

export interface PageLayoutRevisionDoc {      // append-only (use appendOnlyPlugin)
  key: PageKey; scope: string; version: number;
  blocks: BlockBase[]; publishedBy: string; publishedAt: Date; note?: string;
}

export interface UiTextDoc { key: string; value: string; updatedBy: string; updatedAt: Date } // unique key

export interface SiteMediaDoc {   // staff images for pages; separate from user/listing MediaAsset (no KYC/CSAM flow mixing)
  url: string; objectKey: string; alt: string; width: number; height: number;
  bytes: number; contentType: "image/jpeg" | "image/png" | "image/webp";   // no SVG uploads (script risk)
  tags: string[]; uploadedBy: string; createdAt: Date;
} // stored through the existing upload backend (Cloudinary when configured, else local /uploads), folder prefix "site/"

export interface ListingPinDoc {
  scope: string;              // "home" | "hub:<category>" | "hub:<category>/<city>" | "hub:<category>/<city>/<district>"
  listingId: string; position: number; // 1-based slot
  startsAt?: Date | null; endsAt?: Date | null; createdBy: string;
}
```
Listing-page scope resolution when rendering: `url:<exact path>` → `category:<slug>` → `default`. Home and post use `default` only in v1.

Ranking settings live on the existing `Site` document: `site.ranking = { tierOrder: string[]; verifiedFirst: boolean; photoFirst: boolean }`. Default `tierOrder` = today's `TIER` order (`star, super-top, flash, top, highlight, new, auto-boost, free`), `verifiedFirst: true`, `photoFirst: false` → identical order to today (test proves it). Hidden/demoted ad = `listing.feedHidden: boolean` (admin only, audited).

## 3. Block registry v1 (`src/server/layout/blocks.ts`: one zod schema + default props per type)

Common field types: `text` (≤ 160 chars unless noted), `richText` (limited markdown → sanitised HTML via `safeHtml`: headings h2–h3, paragraphs, lists, bold, links), `image` = `{ assetId, src, alt (3–125 chars, required), width, height }`, `link` = `{ label, href }` (`safeHref`).

| Type | Pages | Props |
|---|---|---|
| `hero` | home | heading (h1 on home), subheading, imageDesktop, imageMobile, searchPlaceholder, primaryCta link, secondaryCta link?, overlay (none/light/dark) |
| `categoryGrid` | home, listing | title, intro?, items[] { categorySlug, label?, image?, blurb? } (order = array order), columnsDesktop 2–6, showCounts |
| `cityLinks` | home, listing | title, mode (top cities / manual), citySlugs[], categorySlug? (link target), max |
| `latestAds` | home | title, source (visitor city / fixed city / all), citySlug?, categorySlug?, count 4–24, layout (grid/list), showPhotos |
| `featuredAds` | home, listing | title, listingIds[] (manual picks, order = array) |
| `banner` | all | image?, title?, text?, link?, theme (brand/neutral/accent) — "promo band" |
| `richText` | all | title?, body richText (≤ 2,000 chars) |
| `faq` | home, listing | title, items[] { q, a } (≤ 8) — emits FAQPage JSON-LD only when visible |
| `steps` | home, post | title, items[] { icon, title, text } (≤ 6) — "how it works" |
| `trust` | all | items[] { icon, text } (≤ 6) |
| `seoText` | home, listing | title?, body richText; templates allowed: `{category} {city} {district} {count} {minPrice} {maxPrice} {year}` |
| `listingHeader` | listing | h1Template, introTemplate, showCount, showUpdated (one per listing page, cannot be deleted, can be edited) |
| `filters` | listing | enabled[] (verified, photos, price, + category fields by key), order = array, showOnMobileAs (sheet/inline) |
| `listingFeed` | listing | perPage 12–48, cardFields[] (photo, price, location, date, key attributes, badges), inFeedBlockId? + inFeedEvery (e.g. every 8 cards), emptyTitle, emptyText (one per listing page, cannot be deleted) |
| `districtLinks` / `nearbyCities` / `relatedCategories` | listing | title, max |
| `postIntro` | post | title, text, image? |
| `postStep` | post | stepKey (basics/details/photos/contact/review/promote), title, help, nextLabel, backLabel — one per step; steps cannot be deleted except `promote` (hide only); order fixed in v1 |
| `photoRules` | post | title, items[] text |
| `promotionPicker` | post | title, products[] (codes shown, order = array), defaultCode, note |
| `postSuccess` | post | title, text, primaryCta, secondaryCta |

Field labels, help text, placeholders, required flag and order for each **category's post-form fields** are edited on the **Categories** screen (the `fields` array on each Category already exists). That is how "all text on the posting page" is covered per category.

## 4. Admin panel — look and layout (copy Playzoni's admin pattern, Tharkoo's own code)

Reference: Playzoni `docs/ADMIN.md` §6 and its screenshots (dashboard and "Content and SEO" screens). Rebuilt here in Next.js/React; do not copy files from Playzoni (different stack: Astro).

- **Own admin tokens** in `src/styles/admin.css` (prefix `--adm-`), independent of the public theme so a public redesign never breaks the admin: page bg `#EEF3FA`, cards `#FFFFFF`, text `#13203A`, muted `#5B6478`, primary `#2563EB`, primary-soft `#E3ECFD`, success `#16A34A`, warning `#F59E0B`, danger `#DC2626`, border `#DCE3EE`; font Manrope (already loaded); radius cards 16, inputs 12, pills 999; spacing 4/8 scale.
- **Layout**: left sidebar 248 px with group labels (collapses to 72 px icons < 1280 px; bottom-sheet menu on phones), top bar 64 px (page title, global search "Find an ad, user, page", user menu), content max 1440 px, sticky **save bar** at the bottom of editors (Unsaved changes · Save draft · Preview · Publish).
- **Components** (`src/components/admin/ui/`): `KpiCard`, `DataTable` (44 px rows, sticky header, sort, filter, pagination "Show 50 more", **Export CSV**, stacked cards < 768 px), `BarList` (label + value + bar), `Field` / `TextField` with **character counter**, `ImagePicker` (media library modal, alt required), `SortableList` (drag + ↑ ↓ buttons, keyboard accessible), `Toggle`, `DateRange`, `SerpPreview` (Google desktop + mobile snippet, pixel-width truncation), `Notice` (info/warn/error), `EmptyState` (says why + next action), `ConfirmDialog` (type-to-confirm for deletes), `SaveBar`, `Skeleton`.
- **Honesty**: no invented numbers. No data → "No data yet" with the reason. Demo data shows a yellow "Demo data, not real users" bar (as Playzoni does).
- **Phone**: every screen usable at 390 px.

### Sidebar (groups → screens; role in brackets = lowest role that can open)

| Group | Screens |
|---|---|
| Overview | Dashboard [support] |
| Pages | Home page [admin] · Listing pages [admin] · Post-ad page [admin] · UI text [admin] · Menus & footer [admin] · Banners & notices [admin] · Media library [admin] |
| Catalogue | Categories & post fields [admin] · Locations [admin] · Tags / sub-categories [seo_editor] |
| Listings | Moderation queue [moderator] · All ads [moderator] · **Listing order** [admin] · Reports [trust_safety] · ID checks [trust_safety] |
| **SEO** | SEO overview · Pages & issues · Templates · Page overrides · Redirects & 404s · Indexing rules & sitemaps · robots, llms & schema · Search Console [all seo_editor] |
| Money | Promotions · Credit packs · Coupons · Finance [finance] |
| People | Users [support] · Team & roles [superadmin] |
| System | Settings [superadmin] · Feature flags [superadmin] · Audit log [admin] |

Existing admin pages that are not rebuilt yet still open inside the new shell (only the frame changes).

## 5. SEO center (heavy SEO focus)

| Screen | What it does |
|---|---|
| **SEO overview** | KPI cards: indexable pages, pages in sitemap, pages with P0 issues, P1 issues, thin hubs, duplicate titles/descriptions, 404 hits (7 days), redirects; "Run SEO check now" (runs the same rules as `scripts/seo-check.mjs` server-side against `SITE_URL`, stores an `SeoAuditRun`), last run time, trend of issues per run; nightly automatic run. |
| **Pages & issues** | Table of every sitemap URL + probes: path, type, indexable (and **why**: "noindex: 2 ads < minimum 3"), title + length, description + length, H1, canonical, words, schema types, issues; filters (type, city, category, has issue), CSV export; click a row → opens the right editor (template, override, block). |
| **Templates** | Per page type (home, category hub, city hub, district hub, sub-category hub, ad, blog, help) × optional category: title / description / H1 / intro templates with variables `{category} {city} {district} {state} {count} {minPrice} {maxPrice} {year} {site}`; live **SerpPreview** for a chosen sample city, character counters (title 30–65, description 70–160), warnings for duplicates across cities, banned/forbidden words, keyword missing from title/H1. |
| **Page overrides** | Per-URL title, description, H1, canonical, robots (index/noindex), OG image, intro, FAQ — upgrade of today's `/admin/urls` overrides; bulk CSV import/export of titles and descriptions. |
| **Redirects & 404s** | Today's redirect manager + a **404 monitor**: aggregated daily counts of 404 paths (bot vs human, referrer domain), one click "Create 301 to…", chain/loop protection (exists). |
| **Indexing rules & sitemaps** | Min ads to index per page type and per category, cities/categories indexable on/off (**launch cities**), sitemap shard counts and a "Preview sitemap" list, "Why is this URL indexable or not?" checker for any URL, IndexNow: submit URL(s) + log. |
| **robots, llms & schema** | Extra robots `Disallow` lines (validated; cannot block `/`, `/_next/`, sitemaps), `llms.txt` intro and sections, Organization schema (name, logo, sameAs, contact), per-category ad schema type (JobPosting / Product with price / none) with required-field check, OG default image. |
| **Search Console** | Placeholder until a domain exists: "Not connected yet — connect after launch"; later: clicks, impressions, CTR, position per page and query (OAuth, read-only). |
| **Image SEO** (inside Media library) | Images missing alt, oversize files, unused images. |

## 6. Security and performance rules

- Every admin read/write runs on the server with the existing session + role check (`getStaffFromHeaders` / `isStaffRole`); role per screen as in §4. Writes are server actions or `/api/admin/*` with the existing origin check.
- All text is sanitised (`sanitizeRecord`, `safeHtml`, `safeHref`, `safeCssColor`); rich text never allows scripts, iframes, inline event handlers or `style`.
- The forbidden-terms deny-list (`src/server/shared/policy.ts`) is applied on save to every block, UI text, template and override; a hit blocks the save with a clear message.
- Public pages read published layouts through `cached(..., ["layout:<key>"])`; draft/preview only for staff (cookie + role) and always `noindex`.
- No admin JavaScript on public pages.

## 7. Phasing

H3.1 shell + UI kit → H3.2 block engine → H3.3 media library → H3.4 home as blocks → H3.5 listing pages as blocks → H3.6 post page as blocks + category fields editor → H3.7 UI text → H3.8 listing order → H3.9 dashboard.
H4.1 SEO rules module + audit runs → H4.2 SEO overview + Pages & issues → H4.3 Templates + SERP preview → H4.4 Page overrides upgrade → H4.5 Redirects & 404 monitor → H4.6 Indexing rules & sitemaps → H4.7 robots/llms/schema.
Each card keeps PRs ≤ ~400 lines; Haiku may split a card into parts `a`, `b`, … (branch `haiku/h3.2a-...`) — each part its own PR.
