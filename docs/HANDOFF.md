# Handoff — continue from another Cursor account

Tharkoo lives entirely in this repo. Nothing required lives only in a chat.

## Run on a local PC

```bash
git clone <this-repo>
cd <repo>
npm install
cp .env.example .env.local
```

**Mongo (pick one):**

A. Docker (closest to DigitalOcean):

```bash
docker compose up -d
npm run seed
npm run dev
```

B. No Docker — this repo starts an in-memory Mongo for you:

```bash
npm run dev
```

Open http://127.0.0.1:4317

## What is already built

- Public classifieds UI: home, category, city/state, district, ad, search, cities directory, legal pages, report form, 18+ gate, cookies.
- Mongo models + seed (categories, locations, listings, SEO templates, site settings).
- Technical SEO: titles/H1 from templates, canonicals, JSON-LD, sitemap, robots, `?page=` pagination.

## What is not built (next agent)

Follow `docs/PLAN.md` slices 2–5. Next P0 after browse: vendor register + 3-step post wizard writing into the `listings` collection.

## Rules for the next agent

1. Read `docs/PLAN.md`, `docs/seo/PROJECT.md`, `.cursor/rules/karpathy-guidelines.mdc`.
2. Keep URLs exactly as PRD §4.
3. Rename categories in Mongo (or re-seed `src/data/catalog.ts`) — do not hard-code IndiaSkokka category names.
4. Do not add a second backend. Next.js Route Handlers + Mongoose only.
5. `MONGODB_URI` is the only production secret. Never commit `.env.local`.
6. Quote PRD IDs in commits (`PUB-HOME-001`, …).

## Deploy (owner)

1. Create a DigitalOcean Managed MongoDB cluster. Put the URI in Vercel env `MONGODB_URI`.
2. Import this git repo to Vercel → it assigns the preview/production URL.
3. Run `npm run seed` once against production Mongo (from your PC with the URI), or wait for an admin seed screen in slice 4.
4. Point a custom domain in Vercel when ready. DigitalOcean is the database, not the public hostname.
