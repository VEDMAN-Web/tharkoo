# Tharkoo

City-by-category classifieds for India. Browse listings, open a city page, contact a vendor. Built as an original-layout replica of a researched classifieds IA (PRD in `docs/prd/`), **not** a copy of another brand.

**Stack:** Next.js + Node.js + MongoDB. **Vercel** for the public URL. **DigitalOcean** for MongoDB.

## Local

```bash
npm install
cp .env.example .env.local
```

With Docker Mongo:

```bash
docker compose up -d
npm run seed
npm run dev:next
```

Without Docker (in-memory Mongo, seeds on boot):

```bash
npm run dev
```

App: http://127.0.0.1:4317

## Continue in another Cursor account

Read `docs/HANDOFF.md` and `docs/PLAN.md`. The whole plan is in git.

## Deploy

See `docs/deploy.md` — Vercel project + DigitalOcean Managed MongoDB `MONGODB_URI`.
