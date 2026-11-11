# Tharkoo CODE_MAP (10 Nov 2026, repo VEDMAN-Web/tharkoo @ 3ed3849)
Scratch clone: /workspace/tharkoo2/repo (never pushed). Graph: /workspace/tharkoo2/graphify-out/ (graph.json, GRAPH_REPORT.md, graph.html).
Graphify v-latest (`pip install graphifyy`, `graphify update .` = AST only, no LLM cost, 731 nodes / 1,569 edges / 73 communities, 0% inferred).

## 1. Stack
Next.js 16.4.5 (App Router, Turbopack, `trailingSlash: true`), React 19.3, TypeScript strict (but `ignoreBuildErrors: true`), Tailwind 4, Mongoose **9.12** on MongoDB, lucide-react, cva/clsx. No zod, no test runner, no CI, no auth lib. Dev port 4317. `npm run dev` boots in-memory Mongo (mongodb-memory-server) and seeds.

## 2. Folders
| Path | What |
|---|---|
| src/app | 85 `page.tsx` + 4 API routes + sitemap.ts + robots.ts |
| src/components | public chrome (Header, Footer, AdCard, AdDetail, ListingPage, HomeBlocks, PostWizard 320 loc, AuthForm, AgeGate, CookieBanner), `admin/` (AdminShell, CollectionEditor, HomepageEditor), `vendor/` (VendorShell, VendorScreens 102 loc) |
| src/lib | db.ts (needs MONGODB_URI), models.ts (14 Mongoose models), queries.ts (feed/category/city reads, cached), seo.ts (title templates), sanitize.ts, rate-limit.ts (in-memory), admin-auth.ts, credit-packs.ts |
| src/data | catalog.ts (seed taxonomy - **explicit sexual-services copy**), help.ts |
| cursor/ | Cursor-hosted-app identity helper (generated) - only works on Cursor-published apps |
| scripts | dev.mjs, seed.ts, patch-photos.ts, patch-reference-site-copy.ts (reference-site-derived, delete) |
| public | reference-site/ (5 reference-site-derived jpg), placeholders/ (444 KB), default next svgs |
| docs | PLAN.md, HANDOFF.md, deploy.md (Vercel+DO Mongo - outdated), prd/PRD.txt+docx, seo/PROJECT.md |
| .cursor/rules | graphify.mdc, karpathy-guidelines.mdc, tharkoo.mdc (already present) |

## 3. Routes: real vs mock
- **Real (DB-backed read, SSR): 16 pages** - `/`, `/[category]`, `/[category]/[location]`, `/[category]/[location]/[district]`, `/[category]/tag/[tag]`, `/ad/[slug]`, `/search`, `/cities`, `/blog`, `/blog/[slug]`, `/help`, `/help/[slug]`, `/cms/[slug]`, `/contact`, `/admin` (+`/u/account/credits` reads packs only).
- **Admin CRUD (real DB, but auth = Cursor identity only): ~30 `/admin/*` pages** use CollectionEditor against `/api/admin/list` + `/api/admin/mutate` (generic collection editor). Staff gate (`isStaff`) requires a Cursor-signed identity header; on plain Vercel/DigitalOcean nobody can ever log in (`/api/admin/login` returns 405). **Admin is unusable outside Cursor hosting -> real auth mandatory.**
- **Mock / static: 69 pages** - every `/u/*` page (login, register, forgot, reset, verify-email, KYC, post-insert, account/ads, media, credits history, coupons, packs, subscription, notifications, saved, delete...), and static legal/report pages (about, terms, privacy, cookies, grievance, scam-report, submit-report). No form posts anywhere (PostWizard has zero `fetch`).
- API routes (4): `GET /api/catalog` (public, rate-limited), `GET/POST /api/admin/list|mutate|login`.

## 4. Data layer (src/lib/models.ts)
Category, Location (kind: state/city/district; slug-based), Listing (public fields: phone/whatsapp/telegram in plain text, `variant` free/top/supertop/highlight/flash/star, `lastBumpedAt`, `photos[]` of URL strings, `status` default "live", **no ownerId, no User model, no versions, no moderation state**), SeoTemplate, Site (theme/homepage JSON), Page, HelpArticle, BlogPost, CreditPack, Banner, Coupon, BannedWord, FeatureFlag, AttributeGroup, Product.
Missing entirely: User, Session, verification tokens, KYC, Media assets, Wallet/ledger, Orders, Payments, Promotion orders, Reports, Moderation cases, Audit log, Threads. Slug scheme `/ad/{title-slug}-{publicId}/`; hierarchy by slug strings, not ids.

## 5. Auth
- Public: `AuthForm.tsx` sets `localStorage["tharkoo-user"]="yes"` - cosmetic. No sessions, no hashing, no ownership.
- Admin: Cursor identity (see above). Rate limiter is in-process memory (resets per instance; ineffective on serverless, OK on single PM2 process).

## 6. Env vars used today (names only)
MONGODB_URI, NEXT_PUBLIC_SITE_URL, CURSOR_APP_ID, CURSOR_APP_IDENTITY_ISSUER, VERCEL, NODE_ENV. (.env.example lists MONGODB_URI, NEXT_PUBLIC_SITE_URL.) Full target list: see MASTER_PLAN section 9.

## 7. Build / lint / typecheck results (Node 24.22, npm 11.21, fresh `npm install` ok, 8 cores/15 GB box)
| Check | Result |
|---|---|
| `npm install` | OK |
| `eslint .` | **FAIL: 42 errors, 9 warnings** - 37x `@next/next/no-html-link-for-pages` (use `<Link>`), 4x `react-hooks/set-state-in-effect`, 1x `react-hooks/purity` |
| `tsc --noEmit` | **ABORTS: heap out of memory** at 4 GB and 7 GB (never finishes). Bisected: any file that imports `src/lib/models.ts` (e.g. models.ts alone, queries.ts, AdCard.tsx) blows up; trivial files and library imports are fine. Cause = Mongoose 9 `InferSchemaType` over these schemas (Mixed fields). Real type errors are therefore hidden, which is why `ignoreBuildErrors: true` was set. Fix in T0.2: replace InferSchemaType with explicit interfaces (or port sbt models, Mongoose 8-style) and pin mongoose. |
| `npm run build` | **FAIL**: "Compiled successfully", types skipped, then prerender of `/sitemap.xml` needs a live MongoDB (`MONGODB_URI is not set`; with a dead URI it fails the same way). A CI build needs `export const dynamic = "force-dynamic"` / runtime-only DB reads, or a Mongo service container. |
| Tests | 0 |
| Graphify | 731 nodes / 1,569 edges; no path from Login/PostWizard to any model (confirms mocks). Hubs: CollectionEditor, AdminShell, connectDb, getSite, canonical |

## 8. reference-site-derived / policy-risk content to purge (T0.4)
public/reference-site/*.jpg; `scripts/patch-reference-site-copy.ts`; "reference-site" strings in HomeBlocks.tsx, lib/media.ts, [tag] page, catalog.ts comment; docs mention. **catalog.ts + seo.ts DEFAULT_SEO contain explicit sexual-services category names and copy** ("Call Girls", "erotic massages... all sexual services", "Male Escorts", "#1 Adult Classifieds") - see MASTER_PLAN section 0.

## 9. Reuse from VEDMAN-Web/sbt-private-product (read via GitHub connector; private repo, 425 files)
Different shape: monorepo `apps/api` (Express 4 + Mongoose **8** + zod + pino + sharp + bcryptjs + helmet, 60 src files, **30 test files**, vitest + mongodb-memory-server) + `apps/web` (Next, 46 app files, vitest + Playwright) + `packages/shared` (policy, publish-gate, fields, age, slug). Deployed Vercel web + Render API; docs/ARCHITECTURE, API, DATA_MODEL are a ready contract.
**Verdict: reuse the backend domain logic, not the Express server.** Port into the tharkoo Next repo as `src/server/**` called from Route Handlers (single Node process -> fits the 1 GB droplet, matches AGENTS.md "no second backend"):
| sbt file | Reuse |
|---|---|
| models.ts | User/Session/tokens/IdentityVerification/Category(+field defs)/Location(5 levels)/Listing(owner, status machine, media, versions)/MediaAsset/Report/ModerationCase/Promotion*/Payment/AuditEvent (append-only) - **adopt as the data model** (keeps tharkoo Product/Banner/Coupon/Blog/Help/CreditPack/Site CMS models) |
| domain/auth.ts, verification.ts, listings.ts (35 KB), media.ts, payments.ts, promotions-admin.ts, reports.ts, catalog.ts, category-config.ts, location-config.ts, seo-sitemap.ts, site-settings.ts, admin-*.ts, favourites.ts, messages.ts | Port with zod; swap storage (GridFS/Cloudinary adapter exists: storage/cloudinary.ts already), mailer -> Brevo, payments/mock-payment-provider.ts keep as test mode |
| append-only.ts, audit-repository.ts, rate-limit.ts, crypto.ts, safety/csam-scanner.ts (stub), seo/freshness.ts | Port as-is |
| packages/shared (policy deny-list, publish-gate, age, fields, slug) | Port as `src/server/shared` (+ its 4 tests) |
| apps/api/test/* | Port the matching tests alongside each domain (supertest -> direct service/route-handler tests) |
| Not reusable | Express app.ts wiring, Render config, preview-clone scripts, apps/web UI (different design) |
Compatibility notes: sbt = Mongoose 8; tharkoo = Mongoose 9 -> pin tharkoo to `^8.15` first (T0.3) to avoid the InferSchemaType blow-up and port cleanly. sbt policy deliberately forbids escort/adult-services categories (see MASTER_PLAN section 0).

## 10. Tool repos (confirmed URLs)
- Graphify: https://github.com/Graphify-Labs/graphify (`pip install graphifyy`; `graphify update .`; ~145k stars). Already wired in `.cursor/rules/graphify.mdc`.
- Karpathy skills: https://github.com/multica-ai/andrej-karpathy-skills (renamed from forrestchang/andrej-karpathy-skills, which redirects; ~231k stars; a single CLAUDE.md + `.cursor/rules/karpathy-guidelines.mdc`). Already in the repo as `.cursor/rules/karpathy-guidelines.mdc`; for Codex copy the same text into AGENTS.md (done in T0.1).
- Marketing/SEO skills: https://github.com/coreyhaines31/marketingskills (59k stars; ~40 skills incl. seo-audit, programmatic-seo, schema, site-architecture, copywriting, cro, ai-seo, analytics). Install = copy `skills/*` into `.agents/skills/` (Codex/Cursor read it); T0.1.
- "Open SEO": https://github.com/every-app/open-seo (27k stars) = open-source Semrush/Ahrefs alternative (keyword research, rank tracking, competitor, backlinks, site audit, AI visibility) with MCP + agent skills; self-host via Docker or Cloudflare; **needs a DataForSEO API key (pay-as-you-go)**. Verdict: not needed to build; use Google Search Console + Bing Webmaster (free) + `scripts/seo-audit.ts` + the marketingskills `seo-audit`/`programmatic-seo` skills. Revisit OpenSEO after launch (do not self-host it on the 1 GB droplet). Not to be confused with Ryze-AI open-seo-mcp-skills (different project).
