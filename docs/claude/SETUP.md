# One-time setup for the Tharkoo chat (Haiku does this itself in task H0.0)

Run from the repo root. Windows: use **Git Bash** (Claude Code's default shell on Windows). If a command fails because a tool is missing, install it and retry once; if it still fails, report.

> **Windows box** (works in Git Bash and PowerShell; the npm scripts use `cross-env`, so the memory settings work on Windows):
> - Lint: `npm run lint`
> - Typecheck: `npm run typecheck`
> - Tests: `npm test` (176 expected)
> - Build, Git Bash: `unset MONGODB_URI && npm run build` · PowerShell: `$env:MONGODB_URI=$null; npm run build`
> - Local production site: `node scripts/local-prod.mjs`
> - SEO check, Git Bash: `BASE_URL=http://127.0.0.1:4317 node scripts/seo-check.mjs` · PowerShell: `$env:BASE_URL="http://127.0.0.1:4317"; node scripts/seo-check.mjs`

## 1. Repo

```bash
git fetch github && git switch main && git pull --ff-only github main   # the GitHub remote is named "github" here
node -v          # need 20+ (CI uses 24)
npm ci
```

## 2. Skills and tools

**Karpathy guidelines** (inside Claude Code, as slash commands — ask Vedant to type them if you cannot run slash commands yourself):
```
/plugin marketplace add forrestchang/andrej-karpathy-skills
/plugin install andrej-karpathy-skills@karpathy-skills
```
The same rules are already in `.cursor/rules/karpathy-guidelines.mdc` and `CLAUDE.md`; the plugin is a reminder, not a dependency.

**Open SEO skills — optional, skip for now.** Its useful part (keyword volumes) needs a paid DataForSEO key, and the installer downloads and runs outside code, so Claude Code's permission check blocks it. Do not retry or work around the block. H2.1 uses your WebSearch tool instead. If Vedant later buys DataForSEO credits, he runs this once himself in a terminal in the repo folder, then tells you:
```
npx -y skills add every-app/open-seo --agent claude-code
```

**Graphify** (code graph; PyPI name has two y's):
```bash
pip install graphifyy          # or: pipx install graphifyy / uv tool install graphifyy
graphify install --project     # adds the /graphify skill to this repo's .claude/skills
graphify update .              # AST only, no API key, a few seconds
graphify query "where is the sitemap built?"   # smoke test
```
Use `graphify update .` (code only). Do NOT run `/graphify .` on the whole repo: it would send the PRD and the 50 marketing skills through the model and waste tokens. `graphify-out/` is git-ignored; never commit it.

**Headless browser for screenshots and checks**:
```bash
npx playwright install chromium
```

## 3. Local ignore list (do not commit these)

Append to `.git/info/exclude`:
```
.claude/skills/
graphify-out/
.seo-check/
.shots/
```

## 4. Run the production site locally (needed for every SEO or UI check)

Terminal A (leave running):
```bash
node scripts/local-prod.mjs            # seeds an in-memory MongoDB, builds, starts http://127.0.0.1:4317
node scripts/local-prod.mjs --no-build # restart without rebuilding (after a seed-only change)
```
It uses fake local values only and raises the rate limit so crawls are not blocked. Admin login on this local server: `/admin/login/` with the throwaway test admin from `scripts/ui-smoke.mjs` (the values are in `scripts/local-prod.mjs`; never reuse them anywhere real). Rebuild (no `--no-build`) after any code change before checking.

Terminal B:
```bash
BASE_URL=http://127.0.0.1:4317 node scripts/seo-check.mjs     # full crawl, both user agents, ~1 min
SEO_UA=google SEO_LIMIT=100 node scripts/seo-check.mjs         # quick run while iterating
```
Output: summary in the terminal, details in `.seo-check/seo-check.md` and `.seo-check/seo-check.json`. Exit code 1 = P0 problems remain.

Screenshots: ask the `webapp-testing` skill (Playwright) for full-page PNGs at 390×844, 768×1024 and 1440×900. Before navigating, set `localStorage` keys `nl-age=ok` and `nl-cookies=necessary` (via an init script) so the age gate and cookie banner do not cover the page. Save to `.shots/<TASK>/<page>-<width>.png`.

## 5. Expected baseline (H0.0 must roughly reproduce Opus's numbers)

- Sitemap: categories 11 · cities 649 · districts 33 · tags 0 · ads 0 · content 26 (≈ 719 URLs).
- seo-check P0: robots issues 15; "title only in <body> (streamed)" ≈ half of all requests; duplicate title rows ≈ 100.
- Unit tests: 176 passing (29 files). Build passes with `MONGODB_URI` unset.
Small differences are fine. Large differences: report them before doing anything else.
