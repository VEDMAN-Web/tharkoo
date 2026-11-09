# SEO project context (local — OpenSEO MCP was not connected)

Use this until OpenSEO is wired. Do not duplicate into random markdown later; update this file.

## Business overview

City-by-category classifieds for India. Visitors browse free. Verified vendors post. Buyers contact off-platform (phone / WhatsApp / Telegram / email). SparkBeta Tech (Surat). Brand: **Tharkoo**.

Site stage: **new**. Target locale: India, English first (Hindi/Gujarati hreflang later).

## Current goal

Index a full **category × city / district** page grid and rank for `{category} {city}` queries. Success for slice 1: every seeded city×category URL returns 200 with unique title/H1 and listings or a nearby-cities empty state.

## Positioning

Same *shape* as large Indian classifieds (home category blocks, bumped feed, paid card chrome). Different purpose TBD — keep copy generic. Do not target adult/escort queries until the owner says so.

## Competitors (layout/IA only)

- indiaskokka.com — visual/IA reference (Cloudflare-blocked here; PRD is the spec)
- locanto / skokka-family — category+city SEO grid pattern

## Key pages (roles)

- `/` — hub
- `/{category}/` — hub
- `/{category}/{city}/` — **money**
- `/{category}/{city}/{district}/` — money (top cities)
- `/ad/{slug}-{id}/` — spoke / long-tail
- `/cities/` — hub
- `/help/`, `/about/` — other

## Writing preferences

Original wording. Templates live in Mongo `seotemplates` with `{category} {city} {state} {district} {count} {year}`. Banned: copying competitor ad text.

## Search Console

Not connected. When a Vercel domain exists, add the property and export CSVs to `seo-workspace/gsc/` if needed.

## Next SEO workflow after launch

`keyword-research` on the five category names + top 20 cities — only after the owner fills Appendix B names.
