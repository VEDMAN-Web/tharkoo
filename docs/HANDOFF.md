# Handoff

Tharkoo lives entirely in this repo. Nothing required lives only in a chat.

Read in this order before coding:

1. `PROGRESS.md` — task index (status, branch, PR, dependencies, blockers).
2. `progress/<task-id>.md` — what the last coder finished and the exact next step.
3. `docs/WORKFLOW.md` — branches, rebase, CI, relay mode (one coder at a time).
4. `docs/MASTER_PLAN.md` — phases, ownership, env names, deploy.
5. `docs/CODE_MAP.md` — what the code does today.
6. `docs/contracts/` — API and data-model contract. T1.1 adds it; until that PR merges, the directory is absent.
7. `AGENTS.md` — Karpathy, graphify, content policy, where skills live.

## Run on a local PC

```bash
git clone <this-repo>
cd <repo>
npm install
cp .env.example .env.local
```

**Mongo (pick one):**

A. Docker:

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

## What to build next

Follow `PROGRESS.md`. Do not start a task whose dependencies are not merged. Phase 0 order is T0.1, then T0.2, then T0.3 and T0.4.

## Rules for the next agent

1. Own only the paths in `docs/ownership.json` for your task. If you need another path, stop and write `NEED:` in `progress/<task-id>.md`.
2. Keep URLs exactly as PRD §4 (`docs/prd/PRD.txt`).
3. Categories are Mongo documents. Do not hard-code category names in components.
4. No second backend. Next.js Route Handlers + Mongoose only.
5. Never commit secrets or real `.env` values. Names are in `.env.example`.
6. No sexual-service or competitor-brand categories, copy, products, or assets.
7. New npm dependencies only in T0.3, unless your brief lists a package.

## Deploy

App on the existing DigitalOcean droplet. Database is MongoDB Atlas M0 (Mumbai), not a database on the droplet. Build in GitHub Actions and ship the Next.js standalone bundle. Full decision: `docs/MASTER_PLAN.md` section 8.
