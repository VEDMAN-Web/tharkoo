# Tharkoo task cards (written by Opus; built by Haiku one at a time)

Rules for every card: CLAUDE.md §2–4. Do only what the card says. "Read first" is the full reading list.
Branch name = `haiku/<id lowercase>-<slug given in the card>`. Ownership globs below are copied into `docs/ownership.json` by H0.1.

Order: **H0.0 → H0.1 → H1.1, H1.2, H1.5, H1.6 → H0.2 → H0.4 (online preview) → H1.3 → H1.4 → H0.3 → H3.1 → H3.10 (admin + dynamic pages) → H4.1 → H4.7 (SEO center) → H2.1 (keyword data, only once Vedant has chosen his categories) → GATE → H5 (content/IA, SEO v2) → H6 (public redesign) → H7 (launch)**
H5–H7 cards are written by Opus after the GATE (Vedant's decisions D1–D6 + H2.1 data).
Do one card at a time, each from fresh `github/main` after the previous PR is merged.
Cards marked **[Opus line review]** are reviewed line by line; expect a second round.
Big cards may be split into parts `a`, `b`, … (branch `haiku/h3.2a-<slug>`), each its own PR ≤ ~400 lines; say the split in your 3–5 line plan first.

For H3/H4 always read `docs/claude/ADMIN_PLAN.md` sections named in the card (not the whole file).

---

## H0.0 — Setup and baseline (no branch, no PR)

**Goal:** prove the tools work on this computer and reproduce Opus's baseline numbers.
**Read first:** `docs/claude/SETUP.md`, `docs/claude/FINDINGS.md` §B.
**Steps:**
1. Do SETUP.md §1–3. The files from Opus (`CLAUDE.md`, `docs/claude/*`, `scripts/seo-check.mjs`, `scripts/local-prod.mjs`) are already in the working tree but not committed — leave them uncommitted until H0.1.
2. `npm run lint`, `npm run typecheck`, `npm test`, `unset MONGODB_URI && npm run build` on clean `main`.
3. SETUP.md §4: start `node scripts/local-prod.mjs`, run the full `seo-check`.
4. Screenshots of `/`, `/property/surat/`, `/ad/demo-1330/` at 390 and 1440 into `.shots/H0.0/`.
**Acceptance:** report includes: tool versions (node, graphify, playwright), test count, build PASS/FAIL, sitemap counts per shard, seo-check P0 summary lines, list of screenshots. Compare with SETUP.md §5 and say "matches" or list differences.
**Then:** stop and send the report. Do not fix anything.

---

## H0.1 — Workflow plumbing (slug `plumbing`)

**Goal:** let `haiku/*` branches pass CI, register all H-task ownership, and commit Opus's files.
**Files you may change:** `CLAUDE.md`, `docs/claude/**`, `scripts/seo-check.mjs`, `scripts/local-prod.mjs`, `scripts/relay-wait.mjs`, `.github/scripts/ownership-check.mjs`, `docs/ownership.json`, `.gitignore`, `package.json`.
**Read first:** `.github/scripts/ownership-check.mjs` lines 68–90, top of `docs/ownership.json`.
**Steps:**
1. In `ownership-check.mjs` replace the branch regex and task id line with exactly:
   ```js
   const match = branch.match(/^(?:(?:cursor|codex)\/(t)|haiku\/(h))(\d+)\.(\d+)([a-z])?(?:-|$)/);
   ```
   error text: `does not match cursor/t*, codex/t* or haiku/h*`; and
   ```js
   const taskId = `${(match[1] || match[2]).toUpperCase()}${match[3]}.${match[4]}${match[5] ?? ""}`;
   ```
   Change nothing else in that file.
2. In `docs/ownership.json` under `tasks`, add one entry per H card in this file (H0.1 through H4.7): `"H1.1": { "branchPrefix": "haiku/h1.1", "globs": [ ...the card's "Files you may change"... ] }`. Write `[category]` paths exactly as in the card. Keep existing entries untouched. (Split parts like `H3.2a` reuse their card's globs: add `"H3.2a"`, `"H3.2b"` entries only when you split.)
3. `.gitignore`: add `.seo-check/`, `.shots/`, `.relay/`, `.claude/` (keep `graphify-out/`). Do NOT commit `.claude/`, `.relay/`, `graphify-out/`, `.env.local`, `tsconfig.tsbuildinfo`, or any `.agents/**` mode/line-ending change.
4. `package.json` scripts: add `"seo:check": "node scripts/seo-check.mjs"` and `"local:prod": "node scripts/local-prod.mjs"`. No dependency changes, do not touch the lockfile.
5. Commit Opus's files as they are on disk (`CLAUDE.md`, `docs/claude/*.md`, the three `scripts/*.mjs`); in STATUS.md set H0.1 = PR open. `git status` after the commit must show no other staged files.
6. Bonus check: `git diff --stat github/main...HEAD` lists only the files in this card.
**Acceptance:**
- `OWNERSHIP_BASE=github/main GITHUB_HEAD_REF=haiku/h0.1-plumbing node .github/scripts/ownership-check.mjs` → `ownership-check: H0.1 ok`.
- `OWNERSHIP_BASE=github/main GITHUB_HEAD_REF=haiku/h9.9-x node .github/scripts/ownership-check.mjs` → fails with "no docs/ownership.json entry for H9.9".
- `OWNERSHIP_BASE=github/main GITHUB_HEAD_REF=cursor/t5.1-search node .github/scripts/ownership-check.mjs` still resolves `T5.1` (it may fail on paths; it must not fail on the regex).
- Definition of done passes. CI green on the PR.

---

## H0.2 — Make scripts and tests work on Windows (slug `windows`)

**Goal:** every command in CLAUDE.md §3 and SETUP.md works on Vedant's Windows PC (Git Bash and PowerShell) and still works on Linux CI.
**Files you may change:** `package.json` (scripts only), `tests/server/ui/theme.test.ts`, `docs/claude/**`, `CLAUDE.md` (§3 commands only), `.github/scripts/ownership-check.mjs` (one line, see step 4), `docs/ownership.json` (add the H0.4 and H3.10 entries only, globs from their cards), plus any other test file whose only failure on Windows is path separators or line endings (list each in the plan first).
**Read first:** the exact failing commands and errors you saw in H0.0 (paste them into `progress/H0.2.md` first); `package.json` scripts.
**Known causes:**
1. `theme.test.ts` compares `path.relative(...)` (backslashes on Windows) with `/`-style paths in `ALLOW`. Normalise: `const rel = path.relative(root, file).split(path.sep).join("/");`. Change nothing else in the test.
2. npm runs scripts with `cmd.exe` on Windows, so `NODE_OPTIONS=... next build` style prefixes fail there. `cross-env` is already a devDependency: use `cross-env NODE_OPTIONS=--max-old-space-size=4096 next build` (same for `start` and `typecheck`). No new package.
3. CRLF line endings: if a test reads files and compares text, compare after `.replace(/\r\n/g, "\n")`.
4. Planner docs: Opus updates `docs/claude/*.md` between tasks (copies wait in `.relay/kit/`). In `ownership-check.mjs` make every file under `docs/claude/` always allowed, like `progress/`: in the loop, `if (progressOk.has(file) || file.startsWith("docs/claude/")) continue;`. Then copy every file in `.relay/kit/docs/claude/` over `docs/claude/` in this PR (cp, no edits).
**Do not:** add `.gitattributes` or reformat files; change test expectations.
**Acceptance:** on this Windows PC: `npm run lint`, `npm run typecheck`, `npm test` (176/176), `npm run build` with `MONGODB_URI` unset (PowerShell: `$env:MONGODB_URI=$null; npm run build`) all pass; CI (Linux) green on the PR; SETUP.md has a short "Windows" box with the working command for each step.

## H0.3 — Remove competitor reference material from the repo (slug `remove-refs`)

**Goal:** the repo is public; it must not hold a competitor's screenshots, brand name or a "copy their layout" spec (FINDINGS §D).
**Files you may change:** `docs/design/ref/**` (delete), `docs/design/CLONE_SPEC.md` (delete), `docs/design/README.md` (new, 3 lines: "Reference captures were removed on purpose. Tharkoo uses its own design; see docs/claude/ADMIN_PLAN.md and the H6 design brief."), `docs/CODE_MAP.md`, `docs/MASTER_PLAN.md`, `docs/ASSETS.md`, `progress/t0.1.md`, `progress/t0.4.md`, `progress/t0.5.md`, `progress/t9.1.md` (replace the competitor's name with "the reference site"; change nothing else), `tests/server/ui/theme.test.ts` (remove the `docs/design/CLONE_SPEC.md` line from `ALLOW` only), `.github/scripts/forbidden-terms.mjs` (only if needed so it also scans `docs/` except `docs/prd/**`).
**Read first:** `ls docs/design docs/design/ref`; `git grep -il "skokka" -- docs` (list only).
**Acceptance:** `git grep -il "skokka" -- . ':!docs/prd' ':!.github/forbidden-terms.txt'` returns nothing; `docs/design/ref/` gone; tests and forbidden-terms pass. Report: old commit messages and old branch names still contain the name (we do not rewrite history); tell Vedant in one line that he can delete the merged `cursor/*` and `codex/*` branches on GitHub and make the repo private (Opus will guide).

---

## H0.4 — Online preview link from this PC (slug `preview`)

**Goal:** Vedant can open the current site on his phone through a public link, with no accounts.
**Files you may change:** `scripts/preview.mjs` (new, copy from `.relay/kit/scripts/preview.mjs` as is), `package.json` (add script `"preview:online": "node scripts/preview.mjs"` only), `docs/claude/SETUP.md`.
**Steps:**
1. Install Cloudflare's tunnel tool once: `winget install --id Cloudflare.cloudflared -e`. Check it with `cloudflared --version`. No account or login is needed (quick tunnel). If the install is blocked by a permission check, report QUESTION and stop this card.
2. Copy the script, add the package.json line, and add a 5-line "Online preview" box to SETUP.md: how to start and stop it, where the link is, that it works only while the PC is on, and that the link changes on every start.
3. Run `node scripts/preview.mjs` from `github/main` (after H0.2 is merged) as a **background** command and leave it running. The link and the admin login are in `.relay/preview.txt`.
4. Open the link with curl: `/` returns 200; `/robots.txt` says `Disallow: /`; the home page has `noindex` and its canonical is the trycloudflare link; admin login works (POST `/api/auth/login` with the email and password from preview.txt and an Origin header set to the link).
**Report:** put the preview link (not the password) in the report and in `.relay/preview-link.txt`. Tell Vedant in one line: "Preview is live at <link>. The admin login is in the file .relay/preview.txt in the project folder." From now on, after every merged PR that changes what visitors see, restart the preview so it shows `github/main`, then update both the link file and the report.
**Never:** print the admin password in chat or a report, or point the preview at a real database.

---

## H1.1 — robots.txt: one rule set for all crawlers (slug `robots`)

**Goal:** fix FINDINGS B1.
**Files you may change:** `src/app/robots.ts`, `tests/server/seo/**`.
**Read first:** `src/app/robots.ts` (26 lines).
**Change:** keep the `SITE_NOINDEX` branch as is. In the indexable branch return exactly one rule: `{ userAgent: "*", allow: "/", disallow: ["/u/", "/search", "/admin/", "/api/"] }` plus the same `sitemap`. Delete the five per-bot groups (they all inherit `*` now).
**Test:** new `tests/server/seo/robots.test.ts`: with `SITE_NOINDEX` unset, `robots().rules` has length 1 and contains the four disallows; with `SITE_NOINDEX=true` it disallows `/`. Restore env after each test.
**Acceptance:** test passes; on local-prod, `curl -s http://127.0.0.1:4317/robots.txt` shows one `User-Agent: *` group with 4 Disallow lines; seo-check "robots issues" = 0.

---

## H1.2 — Title, description, canonical always in `<head>` (slug `head-metadata`)

**Goal:** fix FINDINGS B2.
**Files you may change:** `next.config.ts`.
**Read first:** `next.config.ts`.
**Change:** add one property to `nextConfig`, next to `poweredByHeader`:
```ts
  // Send metadata in <head> for every user agent (Next streams it into <body> for JS-capable
  // bots and browsers by default). Canonical/robots must be in the first HTML for SEO.
  htmlLimitedBots: /.*/,
```
**Acceptance (all on a FRESH build: `node scripts/local-prod.mjs`):**
1. Before the change, record median TTFB of 20 hub URLs: `curl -s -o /dev/null -w "%{time_starttransfer}\n" <url>` (first hit of each URL, so cold). After the change, same 20 URLs on a fresh server. Report both medians. Acceptable if after ≤ before + 0.15 s; if worse, stop and report.
2. Full seo-check: "title only in <body>", "no canonical in <head>", "no meta description in <head>" = 0 for both user agents.
3. Definition of done passes.

---

## H1.3 — Crawler-safe rate limiting (slug `rate-limit`) — Opus reviews this PR line by line

**Goal:** fix FINDINGS B3 without weakening protection for logins and APIs.
**Files you may change:** `src/proxy.ts`, `src/lib/rate-limit.ts`, `tests/server/proxy/**`.
**Read first:** `src/lib/rate-limit.ts` (27 lines), `src/proxy.ts` lines 81–112.
**Do NOT change:** `src/server/auth/rate-limit.ts`, anything under `src/app/api/**`, the origin check, redirects, the 410 logic.
**Changes:**
1. `clientKey(headers)`: use the **last** non-empty entry of `x-forwarded-for` (the one our own Nginx appends), else `x-real-ip`, else `"local"`. Add a one-line comment saying why (first entry is client-controlled).
2. Add to `src/lib/rate-limit.ts` an exported pure function
   `export function limitBucket(path: string, method: string, userAgent: string): { bucket: "search" | "page" | "bot" | "api"; envName: string; fallback: number }`
   - `api`: path starts with `/api/` or method is not GET/HEAD → `SITE_RATE_MAX`, 240
   - `search`: path starts with `/search` or `/api/catalog` → `SEARCH_RATE_MAX`, 30 (checked before `api`)
   - `bot`: GET/HEAD and UA matches `/Googlebot|bingbot|DuckDuckBot|YandexBot|Applebot|OAI-SearchBot|PerplexityBot|Claude-SearchBot/i` → `BOT_RATE_MAX`, 1200
   - `page`: any other GET/HEAD → `SITE_RATE_MAX`, 240
3. In `proxy.ts` use `limitBucket` for the key (`${ip}:${bucket}`) and limit. For buckets `page` and `bot` use the in-memory `allowRequest` only (no Mongo write per page view; the app runs as one process). Buckets `api` and `search` keep the current Mongo `consumeRateLimit` with in-memory fallback.
4. 429 responses get header `Retry-After: 60`. Page/bot buckets return `text/plain` "Too many requests"; api/search keep the current JSON body.
**Tests:** `tests/server/proxy/rate-limit.test.ts`: `clientKey` picks the last XFF entry and falls back correctly; `limitBucket` returns the right bucket for `/`, `/property/surat/`, `/search/?q=a`, `/api/listings/`, a POST to `/u/login/`, and a Googlebot UA on `/property/surat/`; `allowRequest` blocks the (max+1)th call.
**Acceptance:** tests pass; on local-prod started with `SITE_RATE_MAX=240 node scripts/local-prod.mjs --no-build` (after a build): 300 GETs with Googlebot UA in under 60 s → zero 429; 300 GETs with a browser UA → 429s after ~240, each with `Retry-After: 60`; 300 browser GETs each sending a different *first* XFF value but the same last value → still limited. Report the three counts.

---

## H1.4 — Same-name district pages (slug `district-alias`)

**Goal:** fix FINDINGS B4 (`/jobs/kolkata/kolkata-district/` duplicates `/jobs/kolkata/`).
**Files you may change:** `src/lib/seo/district-alias.ts` (new), `src/lib/seo/sitemaps.ts`, `src/lib/queries.ts`, `src/app/[category]/[location]/[district]/page.tsx`, `src/app/[category]/[location]/page.tsx`, `src/components/ListingPage.tsx`, `tests/server/seo/**`.
**Read first:** `src/app/[category]/[location]/[district]/page.tsx` lines 30–110; `src/lib/seo/sitemaps.ts` lines 88–140; then `graphify query "which functions list districts of a city for links or chips?"`.
**Rule (new file `district-alias.ts`):**
```ts
export function normalPlace(name: string) {
  return name.toLowerCase().replace(/\b(district|city|urban)\b/g, "").replace(/[^a-z]/g, "");
}
export function isCityAlias(cityName: string, districtName: string) {
  return normalPlace(cityName) !== "" && normalPlace(cityName) === normalPlace(districtName);
}
```
("Kolkata District", "Surat City", "Chennai" → alias of their city; "Bengaluru Rural", "Choryasi", "Central Delhi" → not.)
**Changes:**
1. District page (metadata and page): if `isCityAlias(city.name, dist.name)` → `permanentRedirect(<city hub path for the same category>)` using the existing path builder (`placePath(cat, city)` or whatever `src/lib/urls.ts` uses — check with graphify; do not hand-build URLs).
2. Sitemap `districts` shard: skip alias districts.
3. District chips/links on the city page: skip alias districts. Apply the filter once in the lowest shared function that returns a city's districts *with the city name available*; if no such function exists, filter at the call sites in the files above.
**Tests:** `tests/server/seo/district-alias.test.ts` for the six examples above.
**Acceptance:** seo-check duplicate title and duplicate H1 rows caused by `*-district` pages = 0; `curl -sI http://127.0.0.1:4317/jobs/kolkata/kolkata-district/` → 308 to `/jobs/kolkata/`; the districts shard no longer lists alias districts; screenshots of `/property/surat/` at 390 and 1440 show no "Surat City" chip and no layout change otherwise.

---

## H1.5 — Home page: one clean H1 (slug `home-h1`)

**Goal:** fix the duplicated H1 text (FINDINGS B5). The new wording comes later (H3); keep the current admin-editable text.
**Files you may change:** `src/app/page.tsx`, `src/app/globals.css` (only `.tk-hero*` rules).
**Read first:** `src/app/page.tsx` lines 25–50; `grep -n "tk-hero-desk\|tk-hero-mob" src/app/globals.css`.
**Change:** the `<h1>` contains `content.hero.desktop` once and nothing else. Remove the mobile duplicate spans from inside the H1. If the mobile line breaks matter visually, use CSS (`max-width` / `text-wrap: balance`) on the H1, not a second copy of the text. Do not change `content` shape or the admin editor.
**Acceptance:** seo-check shows no "h1 text repeats itself"; home H1 text (from the crawl JSON) equals the hero text exactly once; screenshots at 390/768/1440 before and after look the same or better (no overflow, no clipped words).

---

## H1.6 — Titles and descriptions: length and grammar (slug `meta-lengths`)

**Goal:** fix FINDINGS B6 for non-hub pages and category hubs. Do not change city/district hub templates (that is H3).
**Files you may change:** `src/app/[category]/page.tsx`, `src/app/cities/page.tsx`, `src/app/categories/page.tsx`, `src/app/blog/page.tsx`, `src/app/help/page.tsx`, `src/app/contact/page.tsx`, `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`, `src/app/cookies/page.tsx`, `src/app/scam-report/page.tsx`, `src/app/safety/page.tsx`, `src/app/how-it-works/page.tsx`, `src/app/prohibited-items/page.tsx`, `src/app/cms/[slug]/page.tsx`, `src/app/help/[slug]/page.tsx`, `src/app/blog/[slug]/page.tsx`.
**Read first:** `.agents/skills/seo-audit/SKILL.md` (titles/descriptions section only), then each file's `generateMetadata`/`metadata` only.
**Rules:** title 30–65 chars, unique, brand last as ` | Tharkoo`; description 70–160 chars, plain English, says what the page offers, no keyword stuffing, no forbidden terms. Category hub default: title `{Category} classifieds across India | Tharkoo`, description `Browse {category} ads from people across Indian cities. Filter by city and district, see photos, and contact posters directly.` (trim to ≤ 160). For CMS/help/blog pages where the title comes from the database, append ` | Tharkoo` only if missing, and pad short titles with a short descriptor (e.g. `Help: Posting an ad | Tharkoo`). Admin per-URL overrides must still win (`withUrlSeo`).
**Acceptance:** seo-check P1 "title length" and "description length" = 0 on indexable 200 pages; no duplicates introduced; list every old → new title in `progress/H1.6.md`.

---

## H2.1 — Keyword and SERP evidence pack (slug `keywords`) — data only, no code

**Goal:** collect evidence so Opus can write SEO_PLAN v2. Do not write recommendations; collect facts.
**Files you may change:** `docs/claude/reports/**`.
**Skills:** Open SEO `keyword-research` (only if a DataForSEO key is configured — check, don't ask for one), otherwise your WebSearch tool.
**Seed list:** 4 cities (Surat, Ahmedabad, Vadodara, Rajkot) × these 12 intents = 48 queries:
`flats for rent in {city}`, `1 bhk flat for rent in {city}`, `house for sale in {city}`, `plot for sale in {city}`, `used cars in {city}`, `second hand bike in {city}`, `jobs in {city}`, `part time jobs in {city}`, `used mobile phones in {city}`, `puppies for sale in {city}`, `tuition classes in {city}`, `pg in {city}`.
**For each query record (CSV `docs/claude/reports/H2.1-serp.csv`):** query, city, intent, top 10 result domains in order, result type of #1–#3 (portal listing page / article / Facebook / Google Jobs box / map pack / other), whether a classifieds portal (OLX, Quikr, MagicBricks, 99acres, Housing, NoBroker, CarDekho, Cars24, Naukri, Indeed, Apna, Locanto, Click.in) is in the top 3, search volume (number or `unknown`), and up to 5 related/"people also search" phrases seen.
**Also:** for the 3 queries where non-portal pages rank highest, open the #1 result and note in one line why it ranks (content type, freshness, locality detail). No copying text.
**Summary file `docs/claude/reports/H2.1-summary.md`:** counts only (how often portals hold top 3 per intent; which intents show Google Jobs or map packs; volumes found or not). ≤ 60 lines.
**Acceptance:** 48 rows; no invented numbers; forbidden-terms clean; files only under `docs/claude/reports/`.
**Then:** report. Opus uses this for SEO_PLAN v2 (H5 cards). You continue with H3.1 once STATUS.md says so.

---

# Phase H3 — Admin panel + dynamic pages (spec: ADMIN_PLAN.md)

## H3.1 — Admin shell and UI kit, Playzoni-style (slug `admin-shell`)

**Goal:** new admin frame and shared components; every existing admin page opens inside it.
**Files you may change:** `src/styles/admin.css` (new), `src/components/admin/AdminShell.tsx`, `src/components/admin/ui/**` (new), `src/components/admin/nav.ts` (new), `src/app/admin/layout.tsx`, `src/app/styleguide/admin/**` (new, noindex), `tests/server/ui/admin-nav.test.ts`.
**Read first:** ADMIN_PLAN §4; `src/components/admin/AdminShell.tsx`; `src/app/admin/layout.tsx`; `src/lib/admin-auth.ts` (role helpers only).
**Build:**
1. `admin.css` with the `--adm-*` tokens and layout from ADMIN_PLAN §4; import it only from `src/app/admin/layout.tsx` (never on public pages).
2. `nav.ts`: groups and items exactly as the sidebar table in §4, each `{ id, label, href, icon (inline SVG path), minRole }`. Items whose page does not exist yet link to a placeholder that shows `EmptyState` "Coming in <task id>".
3. `AdminShell`: sidebar 248 px (72 px icons < 1280 px, bottom-sheet menu button on phones), top bar 64 px with title and a search box (UI only for now), active item highlighted, items hidden when the viewer's roles are below `minRole`. Keep the `AdminShell({ title, children })` signature so all existing pages keep working.
4. UI kit in `src/components/admin/ui/`: `KpiCard`, `DataTable` (sort, client filter, "Show 50 more", Export CSV, stacked cards < 768 px), `BarList`, `TextField` (label, help, error, character counter with min/max colouring), `Toggle`, `SortableList` (drag and ↑ ↓ buttons), `Notice`, `EmptyState`, `ConfirmDialog` (type-to-confirm), `SaveBar`, `Skeleton`, `SerpPreview` (title cut at 580 px desktop / 920 px for 2 lines on mobile using canvas text measure; description cut at 920 px desktop). No new npm packages (drag with HTML5 drag events).
5. `/styleguide/admin/` page (noindex) showing every component with sample props.
**Test:** `admin-nav.test.ts`: role filtering (`support` sees Dashboard/Users only from the table; `superadmin` sees all; `seo_editor` sees the SEO group).
**Acceptance:** screenshots of `/admin/` (signed in as bootstrap admin on local-prod) and `/styleguide/admin/` at 390/768/1440; no horizontal scroll; every old admin page still loads (open each link once: HTTP 200, no console error) — list them in the report; no admin CSS/JS on `/` (check page source for `admin.css` / `--adm-`).

## H3.2 — Block engine: models, registry, service, renderer (slug `blocks-engine`) [Opus line review]

**Goal:** the data layer and renderer every dynamic page uses. No page uses it yet.
**Files you may change:** `src/server/models/layout.ts` (new), `src/server/models/index.ts` (export only), `src/server/layout/**` (new), `src/lib/layout/**` (new), `src/components/blocks/**` (new), `src/app/admin/layout-actions.ts` (new), `tests/server/layout/**`.
**Read first:** ADMIN_PLAN §2, §3, §6; `src/server/models/cms.ts` lines 1–40 and 280–320 (model pattern); `src/lib/ui/site-store.ts` lines 90–140 (save + audit pattern); `src/lib/cache.ts`; `src/lib/sanitize.ts` exports; `src/server/shared/policy.ts` exports.
**Build:**
1. Models exactly as ADMIN_PLAN §2 (`PageLayout`, `PageLayoutRevision` with `appendOnlyPlugin`, `UiText`, `SiteMedia`, `ListingPin`) using `registerModel` + `modelName`.
2. `src/server/layout/blocks.ts`: `BLOCKS` registry `{ [type]: { pages: PageKey[]; schema: ZodType; defaults: () => props; deletable: boolean; max?: number } }` for every type in §3. Rich text through `safeHtml`; links through `safeHref`; images require alt 3–125 chars.
3. `src/server/layout/service.ts`: `getPublished(key, scope)`, `getDraft(key, scope)`, `saveDraft({key, scope, blocks, email, roles})` (validate every block, policy deny-list on all strings, ids generated server-side for new blocks, non-deletable blocks must remain), `publish({key, scope, email, roles, note?})` (copy draft → published, version+1, write revision, audit `layout.publish`, `invalidateTags(["layout:"+key])`), `restore({key, scope, version, email, roles})` (revision → draft), `listRevisions`. Roles: `admin`/`superadmin` only.
4. `src/lib/layout/read.ts`: `getPageBlocks(key, scopes: string[], now)` → first scope that has a published doc, filtered by `visible`, date window; cached with tag `layout:<key>`. Returns `null` when nothing is published (pages then use their current hard-coded rendering — keeps the site unchanged until H3.4).
5. `src/components/blocks/BlockRenderer.tsx`: maps type → component; unknown type renders nothing; `devices` handled with CSS classes (`tk-only-mobile` / `tk-only-desktop`). Components for `richText`, `banner`, `faq`, `steps`, `trust`, `seoText` now (others arrive with their pages). Template variables replaced by `fillTemplate` (existing helper; find with graphify).
6. `layout-actions.ts`: server actions wrapping the service for the admin UI (load, saveDraft, publish, restore, revisions).
**Tests** (`tests/server/layout/`): schema rejects missing alt, script/`onerror` in rich text, `javascript:` links, forbidden terms; saveDraft refuses removing a non-deletable block; publish bumps version and writes exactly one revision; revisions cannot be updated (append-only); scope fallback url → category → default; date window hides blocks; non-admin role → forbidden.
**Acceptance:** tests pass; no public page output changes (seo-check P0/P1 counts identical to before the PR).

## H3.3 — Media library (slug `media-library`)

**Goal:** staff upload and pick images with alt text.
**Files you may change:** `src/server/layout/media.ts` (new), `src/app/admin/media/**` (new), `src/components/admin/ui/ImagePicker.tsx` (new), `tests/server/layout/media.test.ts`.
**Read first:** ADMIN_PLAN §2 (`SiteMedia`), §5 (Image SEO); `graphify explain "uploadMedia"` or the existing upload service for listing photos (Cloudinary/local) — reuse its storage functions, do not reimplement storage.
**Build:** upload (jpeg/png/webp ≤ 5 MB, read width/height, alt required), list with search/tags, edit alt/tags, delete (blocked if a published or draft block uses it — show where), "Images missing alt" filter. `ImagePicker` modal used by block editors: choose existing or upload new.
**Acceptance:** tests for type/size limits, alt required, delete-blocked-when-used; screenshots of `/admin/media/` at 390/1440.

## H3.4 — Home page fully dynamic (slug `home-blocks`)

**Goal:** `/` renders only from blocks; admin edits everything on it.
**Files you may change:** `src/app/page.tsx`, `src/components/HomeBlocks.tsx`, `src/components/blocks/**`, `src/server/layout/defaults/home.ts` (new), `src/app/admin/homepage/**`, `src/components/admin/layout-editor/**` (new), `src/server/seed/layouts.ts` (new), `scripts/seed.ts` (one line to call the layout seed), `tests/server/layout/home.test.ts`.
**Read first:** ADMIN_PLAN §1, §3 (home rows), §4 (SaveBar), §8 (placeholder defaults: the default home blocks are neutral, no portraits or dating slogans); `src/app/page.tsx`; `src/components/HomeBlocks.tsx`; `src/lib/ui/site-content.ts` lines 1–120.
**Build:**
1. Block components: `hero`, `categoryGrid`, `cityLinks`, `latestAds`, `featuredAds` (reuse current markup and `tk-` classes so the page looks the same).
2. `defaults/home.ts`: converts the current `SiteContent` (hero, cards, groups, seoIntro) into a block list that renders the same page. The layout seed publishes it as `home/default` v1 if none exists (idempotent).
3. `page.tsx`: if `getPageBlocks("home", ["default"])` returns blocks → render them (H1 = the `hero` heading; if the hero is hidden or deleted, render the first `richText` title as H1, else a visually hidden H1 from UI text `home.h1`); else current rendering.
4. Generic **Layout editor** (`src/components/admin/layout-editor/`): list of blocks (SortableList with label, type, visibility toggle, device chips, schedule, duplicate, delete with ConfirmDialog), "Add block" (only types allowed for the page), a form per block type generated from a small field map (text → TextField with counter, richText → textarea with preview, image → ImagePicker, items → repeatable rows with SortableList, select → native select), SaveBar (Save draft / Preview opens `/?preview=layout` for staff / Publish with optional note), Revisions drawer with Restore. `/admin/homepage/` uses it for `home/default`.
5. Home title/description stay in SEO templates (H4.3); the editor shows a link "Edit SEO title & description".
**Acceptance:** before/after screenshots of `/` at 390/768/1440 look the same; seo-check unchanged or better; in admin: change hero text, swap image, reorder two blocks, hide one, add a `richText`, publish → visible on `/` within 5 s; restore v1 → page back. Report with screenshots of each step.

## H3.5 — Listing pages fully dynamic (slug `listing-blocks`)

**Goal:** category, city and district hubs render from blocks, editable per category or per exact URL.
**Files you may change:** `src/app/[category]/page.tsx`, `src/app/[category]/[location]/page.tsx`, `src/app/[category]/[location]/[district]/page.tsx`, `src/components/ListingPage.tsx`, `src/components/blocks/**`, `src/server/layout/defaults/listing.ts` (new), `src/server/seed/layouts.ts`, `src/app/admin/listing-pages/**` (new), `tests/server/layout/listing.test.ts`.
**Read first:** ADMIN_PLAN §2 (scopes), §3 (listing rows); `src/components/ListingPage.tsx`; the city page file lines 1–140.
**Build:** block components `listingHeader`, `filters`, `listingFeed` (with in-feed banner every N), `districtLinks`, `nearbyCities`, `relatedCategories`; default layout reproducing today's page; scopes resolved `url:<path>` → `category:<slug>` → `default`. Admin `/admin/listing-pages/`: pick scope (Default / a category / a specific URL), then the same Layout editor. Indexing logic, canonicals and JSON-LD stay in code (not editable here).
**Acceptance:** before/after screenshots of `/property/`, `/property/surat/`, a district page at 390/1440 identical; a `category:property` layout changes only property hubs; a `url:/property/surat/` layout changes only that URL; seo-check unchanged or better.

## H3.6 — Post-ad page dynamic + category post fields editor (slug `post-blocks`)

**Goal:** every word on the posting flow is editable; each category's form fields are editable.
**Files you may change:** `src/app/u/post-insert/**`, `src/components/PostWizard.tsx`, `src/components/post/**`, `src/components/blocks/**`, `src/server/layout/defaults/post.ts` (new), `src/server/seed/layouts.ts`, `src/app/admin/post-page/**` (new), `src/app/admin/categories/**`, `src/components/admin/category-fields/**` (new), `tests/server/layout/post.test.ts`.
**Read first:** ADMIN_PLAN §3 (post rows + the paragraph under the table); `src/components/PostWizard.tsx` (structure only: grep for step names and visible strings); the Category `fields` schema in `src/server/models/catalog.ts`.
**Build:** blocks `postIntro`, `postStep` (one per step, titles/help/button labels), `photoRules`, `promotionPicker`, `postSuccess`; PostWizard reads them (fallback = today's strings). Categories screen: edit each field's label, help, placeholder, required, order, options (select/chips), with SortableList; changes validated by the existing category field schema and audited. Posting logic, validation rules and KYC gate unchanged.
**Acceptance:** tests that a saved field label appears in the wizard data and that validation still rejects a missing required field; screenshots of all wizard steps at 390/1440 before/after (same); edit one label + one help text + hide the promote step → visible after publish.

## H3.7 — UI text dictionary (slug `ui-text`)

**Goal:** remaining microcopy on the three pages (buttons, empty states, errors, filter labels, card labels) editable.
**Files you may change:** `src/lib/ui/text.ts` (new: `t(key)` server helper + `TEXT_DEFAULTS`), `src/app/admin/ui-text/**` (new), the three pages' components already listed in H3.4–H3.6 (string replacements only), `src/components/ui/AdCard.tsx`, `tests/server/layout/ui-text.test.ts`.
**Read first:** ADMIN_PLAN §1 point 2; then `grep -n '"[A-Z][a-z]' <each component>` to list visible strings.
**Build:** every visible string left on home, listing and post pages (and the ad card) moves to `TEXT_DEFAULTS` with keys like `card.contact.call`; `t()` reads `UiText` overrides (cached, tag `layout:text`). Admin `/admin/ui-text/`: table grouped by page, search, edit inline with counter, "Reset to default", audit.
**Acceptance:** a script-free check in the report: list of all keys (count) and `grep` showing no remaining hard-coded English sentences in those components (paste the grep); edit 3 keys → visible after save.

## H3.8 — Listing order control (slug `listing-order`) [Opus line review]

**Goal:** admin controls the order of ads on home and listing pages.
**Files you may change:** `src/server/ranking/**`, `src/lib/queries.ts` (ordering call sites only), `src/server/models/cms.ts` (Site `ranking` field), `src/server/models/listing.ts` (`feedHidden` field), `src/app/admin/listing-order/**` (new), `tests/server/ranking/**`.
**Read first:** ADMIN_PLAN §2 (ranking settings, `ListingPin`); `src/server/ranking/score.ts` (70 lines); `graphify query "where are rankScore and compareRank called?"`.
**Build:** `rankScore`/`compareRank` take an optional settings object `{ tierOrder, verifiedFirst, photoFirst }` (defaults = today's behaviour); pins applied after sorting (pinned ad moved to its position within its date window, only if active and in that feed's filter); `feedHidden` ads skipped in feeds (still reachable by URL). Admin screen: tier order (SortableList), two toggles, pins table per scope (add by ad ID/URL, position, dates, remove), hide/unhide an ad, and **Preview**: choose a page (home or a hub) → shows the first 20 ads in the new order before saving. All changes audited.
**Tests:** default settings give exactly the same order as before on a fixed fixture (snapshot of 30 listings); tier reorder changes order as expected; pin at position 1 with expired dates is ignored; hidden ad absent from feed but its page still 200.
**Acceptance:** tests; screenshots of the admin screen and of `/property/surat/` before/after one pin.

## H3.9 — Dashboard (slug `dashboard`)

**Goal:** a real Playzoni-style overview with real numbers only.
**Files you may change:** `src/app/admin/page.tsx`, `src/server/admin/dashboard.ts` (new), `tests/server/admin/dashboard.test.ts`.
**Read first:** ADMIN_PLAN §4 (honesty), Playzoni reference described there; `src/app/admin/page.tsx`.
**Build:** KPI cards (live ads, pending moderation, new ads today/7 days, new users 7 days, ID checks waiting, open reports, contact reveals 7 days if logged, promotions active); BarLists (ads by category, by city, top 10); line of new ads per day (30 days, simple SVG, no chart library); "Demo data" bar when demo listings exist. Fix today's wrong counts (`status: "live"`, `kind: "city"` → new model fields).
**Acceptance:** numbers match direct Mongo counts in a test fixture; screenshots 390/1440.

## H3.10 — Partner CSV bulk import (slug `bulk-import`)

**Goal:** a verified partner (broker, car dealer, job agency) gets 20–50 real listings live in one step (SEO_PLAN §10 A6).
**Files you may change:** `src/server/listings/import.ts` (new), `src/app/admin/import/**` (new), `tests/server/listings/import.test.ts`.
**Read first:** SEO_PLAN §10 A6; `graphify explain "createListing"` (or the listings service create/draft function) — reuse it, do not duplicate validation.
**Build:** admin uploads a CSV for a chosen partner account (account must be ID-verified): columns category, city, district, title, description, price, category fields (by key), photo URLs (only from our own upload storage or the partner's already-uploaded media). Dry run first: a table of rows with OK / errors per row (same validation and forbidden-terms check as the post form). Then import as `pending` (normal moderation queue) or, for superadmin, `active`. Max 200 rows per file. Audited (`listing.import`, row count).
**Acceptance:** tests for a valid file, a row with a missing required field, a forbidden term, an unverified partner (refused), and the 200-row limit; screenshots of dry run and result at 390/1440.

---

# Phase H4 — SEO center (spec: ADMIN_PLAN §5)

## H4.1 — SEO rules module + audit runs (slug `seo-audit-engine`)

**Files you may change:** `src/server/seo/audit-rules.ts` (new), `src/server/seo/audit-run.ts` (new), `src/server/models/seo.ts` (new: `SeoAuditRun` {startedAt, finishedAt, base, counts, rows[] capped 5,000, triggeredBy}), `src/server/models/index.ts` (export), `scripts/seo-check.mjs` → `scripts/seo-check.ts` (thin wrapper using the module; keep the same CLI options and output), `package.json` (`seo:check` → `tsx scripts/seo-check.ts`), `src/app/api/cron/seo-audit/**` (new, secret header like other crons), `tests/server/seo/**`.
**Read first:** `scripts/seo-check.mjs`; one existing cron route under `src/app/api/cron/` for the secret-header pattern.
**Build:** move `analyse`, `issues`, duplicate and robots logic into pure functions (`audit-rules.ts`) with unit tests on small HTML fixtures; `audit-run.ts` crawls `SITE_URL` (concurrency 2, 100 ms gap, Googlebot UA, max 5,000 URLs) and stores a run; cron endpoint triggers it; keep only the last 30 runs.
**Acceptance:** `npm run seo:check` output equals the old script on local-prod (same P0/P1 counts); unit tests for each rule.

## H4.2 — SEO overview + Pages & issues screens (slug `seo-overview`)

**Files you may change:** `src/app/admin/seo/**`, `src/server/seo/explain.ts` (new: "why indexable or not" for a URL using the same functions the pages use), `tests/server/seo/explain.test.ts`.
**Build:** screens per ADMIN_PLAN §5 rows 1–2 using the UI kit; "Run SEO check now" (seo_editor+, max once per 10 min); issues trend (last 30 runs); Pages table with filters, CSV, and a link from each row to the right editor (template / override / layout).
**Acceptance:** screenshots 390/1440; explain() unit tests for: thin hub, page ≥ 2, filter params, demo ad, alias district (after H1.4), override noindex.

## H4.3 — SEO templates editor with SERP preview (slug `seo-templates`)

**Files you may change:** `src/app/admin/seo/templates/**`, `src/server/seo/templates.ts` (new; wraps `SeoTemplate` with validation), `src/lib/seo/landing.ts` (read templates per page type × category), the hub pages' `generateMetadata` (template lookup only), `tests/server/seo/templates.test.ts`.
**Build:** per page type × optional category: title/description/H1/intro templates, variables list with click-to-insert, SerpPreview for a chosen sample city/category with live values, counters, warnings (length, duplicates across 20 sample cities, forbidden terms, main keyword missing from title or H1). Category-specific template wins over the page-type default; per-URL override (H4.4) wins over both.
**Acceptance:** tests for precedence and validation; screenshots; change the city-hub title template → seo-check shows the new titles.

## H4.4 — Page overrides upgrade + bulk CSV (slug `seo-overrides`)

**Files you may change:** `src/app/admin/urls/**`, `src/components/admin/UrlsManager.tsx`, `src/server/urls/service.ts` (override fields only), `src/lib/seo/override.ts`, `tests/server/urls/**`.
**Build:** per-URL title, description, H1, canonical, robots, OG image (ImagePicker), intro, FAQ (≤ 8); SerpPreview; bulk export/import CSV (path,title,description,h1,robots) with a dry-run diff before apply; validation identical to templates.
**Acceptance:** tests for CSV dry-run and validation; screenshots.

## H4.5 — Redirects & 404 monitor (slug `seo-404`)

**Files you may change:** `src/app/not-found.tsx` (log hook only), `src/server/seo/notfound-log.ts` (new: daily aggregate `{day, path, hits, botHits, refDomain}`, capped), `src/server/models/seo.ts`, `src/app/admin/urls/**` (404 tab), `tests/server/seo/notfound.test.ts`.
**Build:** log 404s cheaply (one upsert per path per day; skip `/_next/`, assets, admin); 404 tab with filters and "Create 301 to…" using the existing redirect service (chain/loop rules apply).
**Acceptance:** tests; visiting a missing URL 3 times shows hits 3; create redirect → 308/301 works.

## H4.6 — Indexing rules & sitemaps (slug `seo-indexing`)

**Files you may change:** `src/app/admin/seo/indexing/**`, `src/server/seo/indexing.ts` (new: thresholds, indexable cities/categories), `src/server/models/cms.ts` (Site `seoIndexing` field), `src/lib/seo/sitemaps.ts`, the hub pages' `isThin`/index decision call sites, `src/server/indexnow/**`, `tests/server/seo/indexing.test.ts`.
**Build:** thresholds per page type and per category (defaults = today: 3 / 10), cities and categories indexable on/off (off → noindex + out of sitemap), sitemap shard counts + preview list, "Why is this URL indexable?" box (uses H4.2 explain), IndexNow manual submit with log (no live call unless `INDEXNOW_KEY` is set).
**Acceptance:** tests: city off → its hubs noindex and absent from sitemap; threshold change moves pages in/out; seo-check after toggling one city.

## H4.7 — robots, llms.txt and structured data settings (slug `seo-schema`)

**Files you may change:** `src/app/robots.ts`, `src/app/llms.txt/**`, `src/app/llms-full.txt/**`, `src/lib/seo/schema.ts`, `src/server/models/cms.ts` (Site `seoSettings` field), `src/app/admin/seo/settings/**`, `tests/server/seo/**`.
**Build:** extra robots `Disallow` lines (validated per ADMIN_PLAN §5; superadmin only), llms.txt intro and sections, Organization fields, per-category ad schema mapping (JobPosting / Product-with-price / none) with a required-fields checker that lists ads that would be skipped, default OG image.
**Acceptance:** tests: cannot disallow `/`; JobPosting omitted when a required field is missing; robots still passes seo-check; screenshots.

---

## H1.7 — Visual fix pass + gold theme (Vedant's audit, 11 Nov) — split into 4 PRs: H1.7a, H1.7b, H1.7c, H1.7d

**Goal:** visitors must love the site at first sight. Replace the maroon/plum look with a premium **gold and light-gold** theme, and fix alignment, sizing and consistency on every public page and the user dashboard. This pulls the core of the redesign forward. It changes looks only: no data, URL, SEO or logic changes.

### Theme: "Ivory & Gold" (do in H1.7a, first commit; every later part uses only these tokens)
Replace the values in `src/styles/tokens.css` (keep the token NAMES the components already use; map old plum and rose tokens to these). Contrast was checked by Opus; `tests/server/ui/theme.test.ts` must still pass. Update its expected pairs only if a token name changes, never lower the 4.5 limit, and never put the word "dark" in tokens.css (the test forbids it).
| Role | Hex | Use |
|---|---|---|
| page bg | `#FFFCF5` | warm ivory page |
| card | `#FFFFFF` | cards, dialogs |
| tint | `#FBF5E4` | section bands, chip backgrounds, hover |
| tint-strong | `#F6EBCB` | selected chips, badges, input focus glow |
| text | `#1F1A12` | headings and body |
| muted | `#6B6255` | secondary text |
| primary (deep gold) | `#8A6416` | links, icons on light, outline buttons, active states (5.2:1 on ivory) |
| gold | `#D4AF37` | primary button fill (text `#1F1A12`), stars, badges, thin accents |
| gold-light | `#E2C268` | button hover, highlight borders |
| hairline | `#EADFC4` | 1 px card borders and dividers |
| hero gradient | `#2A2316` → `#5C4A22` | home hero and the "post your ad" band only; text on it is `#FFFFFF`, and the H1 accent words use `#F3D98B` |
| ok / danger | `#1E6B3A` on `#E8F5EC` / `#B42318` | status |
| WhatsApp | `#177A42` | WhatsApp button (white text) |
Buttons: primary = gold fill + ink text + 12 px radius + subtle shadow `0 1px 2px rgba(31,26,18,.12)`; hover = `#E2C268`; secondary = white + 1 px `#8A6416` border + `#8A6416` text. No maroon, plum or rose anywhere (`rg -i "#6A2150|#A63A5E|#5A2158|plum|rose" src` returns 0 hits, except in tokens.css comments, which you should remove).
Card style everywhere: white, 1 px hairline border, 14 px radius, shadow `0 2px 10px rgba(31,26,18,.06)`, on hover lift 2 px with shadow `0 6px 20px rgba(31,26,18,.10)` (150 ms). Badges for promoted tiers: gold pill with ink text (Star/SUPER Top), outline gold pill (Top), tint pill (Highlight/New).
Fonts stay: Cormorant Garamond for display headings (ink colour), Manrope for everything else.

### Text alignment
Vedant asked for justified text "where applicable". Apply `text-align: justify; hyphens: auto; text-wrap: pretty` ONLY to long body paragraphs (ad description, hub intro text, About/legal/help/blog article bodies), and only from 768 px up. On phones keep left alignment, because justified text on narrow screens leaves big gaps between words. Headings, buttons, cards, labels, chips and lists are never justified. Centre only section headings on the home page.

### Structure principles (apply in every part)
- Generous white space: 48 px between sections on desktop, 32 px on phone; one clear H2 per section with a 14 px muted one-line subtitle.
- One visual rhythm: same card radius, border, shadow and padding (16 px phone / 20 px desktop) everywhere.
- Every image has a fixed aspect-ratio box (no jumping, no huge images); object-fit cover.
- Icons from lucide-react only, 18–20 px, in deep gold.
- Every empty state has an icon, one line and one action button.
- Hover and focus states on everything clickable (focus ring 2 px `#8A6416`, 2 px offset).
**Files you may change (all four parts):** `src/app/globals.css`, `src/styles/**`, `src/app/page.tsx`, `src/components/**`, `src/app/[category]/**`, `src/app/ad/**`, `src/app/u/account/**`, `src/app/u/post-insert/**`, `src/lib/ui/site-content.ts` (defaults only), `docs/ownership.json` (add the H1.7a–d entries with these globs, in H1.7a only), `tests/server/ui/**`.
**Rules for every item:** check at 390, 768 and 1440 px. No horizontal scroll, nothing overlapping, nothing cut off, tap targets ≥ 40 px, text ≥ 12 px. Save before and after screenshots to `.shots/H1.7x/`. Do not change data, URLs, SEO tags or logic. Run `node scripts/ui-smoke.mjs` before the PR; it must still pass.
**Global (do in H1.7a):** content max-width 1200 px on desktop (today 960 px looks narrow at 1440), with 16 px side padding on phones. One spacing scale: 4/8/12/16/24/32/48.

### H1.7a — Home, header, footer
1. Hero: the H1 sits directly above the search bar (16 px gap), and both are grouped near the BOTTOM of the banner (search bar bottom edge 40 px above the banner bottom on desktop, 24 px on phone). Left-align them with the content container. The photo stays on the right. The H1 must never overlap the search bar or the photo's face area on phone (on phone, put the text block below the photo or on a dark gradient strip).
2. Category cards ("Latest listings in your city"): each city box shows ONLY the city name (remove the category word above it). City boxes become pills: height 40, padding 0 16, radius 999, 1 px border, wrap with an 8 px gap, centred text. All category cards are equal height in a row; photo area fixed at 16:9 with object-fit cover; title and blurb padding 16. Grid: 3 columns at 1440, 2 at 768, 1 at 390. The last row is centred when it has fewer cards.
3. Remove the "Latest ads" section from the home page completely (do not render it; leave the component file).
4. Header: the small "Admin"/name text under the person icon is misaligned. Show the name only in the dropdown, not under the icon.
5. Footer: remove the grey empty band at the very bottom (copyright gets the same background as the footer, 16 px padding). Hide the "Countries" selector while only one country exists.
6. Change nothing in the hero TEXT; Vedant edits it in /admin/homepage/.

### H1.7b — Listing pages (/{category}/, /{category}/{city}/, district)
1. H1 ("Dating in Mumbai") is tiny and grey. Make it the page title: 32 px desktop / 24 px phone, ink colour, bold display font, with the "Updated …" line under it in muted 13 px.
2. Ad cards, one consistent design for every tier:
   - Desktop: horizontal card with a fixed photo 200 × 250 (4:5, cover) and the text column beside it. Phone: same horizontal card with photo 112 × 140.
   - The card height comes from the photo; the text column clamps the title to 2 lines and the description to 2 lines; the "ID verified · Age verified · Photo verified" line becomes 3 small check badges in one row.
   - The tier badge (Star / SUPER Top / Top / Highlight / New) is a small pill at the top-right of the photo, not floating in the text.
   - Remove the < > photo arrows from list cards (photo count chip stays bottom-left on the photo).
   - Call and WhatsApp icon buttons: 40 × 40, bottom-right of the card, never overlapping text.
   - Promoted tiers differ only by a 2 px plum border (Star/SUPER Top) or a light tint (Highlight). The size is the same for all.
   - No empty white gaps inside cards.
3. "Reach more people / POST YOUR AD" band: the button text is cut off. Button min-width 160, height 44, white background, plum text, never wrapping. The band is 24 px padded and vertically centred.
4. Filter chips (Verified, With photos, district names): pills height 36, one horizontally scrollable row on phone (no wrapping into 2–3 rows).
5. Location search box: full width on phone, 480 px on desktop, aligned with the H1.

### H1.7c — Ad page (/ad/...)
1. Title row: the title on the left; the favourite heart and tier badge on the RIGHT edge of the same row (the heart is in the middle today).
2. Remove the second copy of the title under the badges.
3. Gallery: desktop is one main image (max-height 520, contain on a light background) plus a thumbnail strip (80 × 100) below, with click to switch and click to open the show-all sheet. Phone is one image, max-height 60vh, swipe or arrows, "1/4" counter. No 2×2 giant grid.
4. Call and WhatsApp: on phone show only the sticky bottom bar (remove the duplicate buttons at the top and in "Contact me"). On desktop show one contact card at the top right (sticky on scroll), next to the gallery.
5. Sections (About, Where, Interests): consistent 24 px spacing. The tag chips show the value only ("Coffee"), not "looking for: Coffee" or "tag: individual".

### H1.7d — Dashboard and post-an-ad
1. Dashboard: one grid of equal-height cards (3 columns desktop, 2 tablet, 1 phone): Your ads (active / not published counts + "Post an ad" button), Wallet (credits + "Buy credits"), Profile (name, email, ID status), Coupons, Settings. Each card: icon + title on the left in the header row, content below, the action button at the bottom. Remove the "Tharkoo News" marketing card and the "Stand out" promo card from the dashboard. Move the security tips card to the bottom as one full-width slim notice.
2. Help box: hide the WhatsApp/Telegram buttons while they are not configured (no greyed-out disabled buttons).
3. Post-an-ad: replace the "NO" pill toggles with proper switches (44 × 24, label on the left, state visible by colour and position). The two consent checkboxes become real checkboxes with the label beside them. The "GO ON" button becomes "Continue". Section headings ("Your ad", "Your data", "Your contacts") at 18 px semibold with 24 px space above.
4. The progress bar at the top shows "Step 1 of 3 · Information" text, not just "1/3".

**Acceptance (each part):** before/after screenshots at 390/768/1440 listed in the report; ui-smoke passes; lint/typecheck/test/build green; I review the result on the live preview, so restart the preview on main after each merge.
**Order and speed:** do H1.7a → b → c → d back to back. Each part gets its own PR. After each PR is green, merge it only when I write `MERGE: allowed`. While you wait, start the next part on a new branch from github/main.
