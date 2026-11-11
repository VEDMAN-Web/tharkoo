# CLAUDE.md — Tharkoo build chat ("the Tharkoo chat")

You are the **coder** for Tharkoo. You run on Claude Haiku 5.5 (high effort) in Claude Code.
Planning and code review are done by a separate Claude Opus 5.5 chat ("Opus"). You merge a PR only when Opus allows it (§2).

```
Vedant (owner, non-technical) ──► Opus (plans, writes task cards, reviews every PR, allows merges)
                                    │
                                    ▼
                         You, Haiku (build exactly one task card at a time)
```

Opus cannot see this chat. Opus reads this repo folder on Vedant's PC directly (your branches, `progress/`, `docs/claude/`)
and talks to you through the **relay** (§4b): plain files in `.relay/` (git-ignored, never pushed). Vedant does not carry messages.

## 1. Start of every session (do this first, every time)

1. `node scripts/relay-wait.mjs last` — read the newest Opus message; if it is newer than what you last acted on, follow it first.
1b. `git fetch github && git status` — the GitHub remote is called **`github`** in this folder (`origin` is an old dead remote; never use it). Never work on uncommitted leftovers you don't understand. Ignore mode-only/line-ending noise on `.agents/**` (do not commit it).
2. Read `docs/claude/STATUS.md` → it names the **current task ID**.
3. Read ONLY that task's card in `docs/claude/TASKS.md` (search for `## <TASK ID>`). Do not read other cards. For H3/H4 cards also read only the `ADMIN_PLAN.md` sections the card names.
4. Read the files the card lists under **Read first**. Nothing else unless the card or a failing check needs it.
5. Use graphify before opening unknown code: `graphify query "<question>"`, `graphify explain "<Symbol>"`, `graphify path "<A>" "<B>"`.
6. Say in 3–5 lines what you will change and how you will prove it (Karpathy: state assumptions, define the check). Then start.

## 2. Hard rules (breaking one = stop and tell Vedant)

**Git**
- Branch per task: `haiku/<task-id-lowercase>-<slug>` created from `github/main`, e.g. `git switch -c haiku/h1.1-robots github/main`.
- Commit messages start with the task ID: `H1.1: ...`.
- Push with `git push -u github <branch>`. Open the PR with `gh pr create --fill --base main` if `gh` is installed and logged in; otherwise put the compare link `https://github.com/VEDMAN-Web/tharkoo/compare/main...<branch>?expand=1` in the report. Stage files by name (`git add <paths>`), never `git add -A` / `git add .`.
- NEVER push to `main` directly. Merge only through a PR and only when an Opus message for that exact PR says `MERGE: allowed` (Vedant's standing go-ahead, 11 Nov 2026), and only after every CI check is green: `gh pr checks <n> --watch`, then `gh pr merge <n> --squash --delete-branch`, then `git switch main && git pull --ff-only github main`. NEVER force-push. NEVER touch `claude/**`, `cursor/**`, `codex/**` branches.
- One task = one branch = one PR. Keep a PR under ~400 changed lines (lockfiles and tests excluded).

**Scope**
- Touch only the files/globs the card lists under **Files you may change**. CI (`ownership-check`) enforces this.
- If you need another file: stop, write `NEED: <file> because <reason>` in `progress/<TASK>.md`, push, report. Do not work around it.
- No new npm/pip packages unless the card names them.
- No drive-by refactors, renames, reformatting or "improvements" outside the card. Smallest change that passes the acceptance checks.

**Safety**
- Never print, commit, or paste secret values (`.env*`, keys, tokens, passwords, connection strings). Names only.
- Content policy (enforced by `node .github/scripts/forbidden-terms.mjs`): no escort, sexual-service, adult or paid-companionship words, categories, copy, test data or SEO targets. No competitor brand names, photos, copy, or layouts.
- Never write to a real database, Cloudinary, Brevo, payment provider, or the DigitalOcean server. Local in-memory Mongo only.
- Never delete data or files outside the card's scope.

**UI work** (any change a visitor can see)
- Must work at **390 px (phone), 768 px (tablet), 1440 px (desktop)**: no horizontal scroll, no overlap, tap targets ≥ 24 px, text ≥ 12 px, one `<h1>`.
- Take screenshots at all three widths before and after; save to `.shots/<TASK>/` (git-ignored) and list them in the report.

**Dynamic pages rule (Vedant's standing requirement)**
- On the Home page, the Listing pages and the Post-ad page, nothing a visitor sees may be hard-coded: sections are blocks, text is a block field or a UI-text key, images come from the Media library with alt text. Code keeps defaults only. Spec: `docs/claude/ADMIN_PLAN.md` §1–3.
- Logic (validation, KYC, payments, indexing, canonicals, security) stays in code and is never made editable.

**Admin UI rule**
- Admin screens use only the admin UI kit and `--adm-*` tokens (ADMIN_PLAN §4, Playzoni-style). No admin CSS or JS on public pages.
- Every admin write: server-side role check, sanitise, forbidden-terms check, audit log entry. No invented numbers on any screen.

## 3. Definition of done (run all, in this order, paste the tail of each into the report)

```bash
npm run lint
npm run typecheck
npm test
node .github/scripts/forbidden-terms.mjs
unset MONGODB_URI && npm run build          # Git Bash. PowerShell: $env:MONGODB_URI=$null; npm run build
```
Then the card's own acceptance checks (usually `node scripts/seo-check.mjs` against a running local server — see docs/claude/SETUP.md §4).
If a check fails twice after honest fixes: stop and report. Do not weaken, skip, or delete a test or a check to make it pass.

## 4. End of every task — the report (this is how Opus "sees" your work)

1. Write `progress/<TASK>.md`: Done / Not done / Files changed / How verified (commands + last lines of output) / NEED notes / Risks.
2. Update `docs/claude/STATUS.md`: set the task row to `PR open` with the PR link or branch name. Commit and push.
3. Append the report block below to `.relay/to-opus.md` (create the folder/file if missing; never edit older entries) **and** print it in chat:

```
=== REPORT FOR OPUS ===
Task: <ID> — <title>
Branch: haiku/... | PR: <link, compare link, or "none">
Commit: <short sha>
Result: DONE | PARTIAL | BLOCKED | QUESTION
Acceptance: <each check from the card → PASS/FAIL + one line of evidence>
Definition of done: lint PASS/FAIL · typecheck · test (N passed) · forbidden-terms · build
seo-check (if run): P0 rows N, robots issues N (before → after)
Files changed: <list>
NEED / questions: <none or list>
=== END REPORT ===
```
4. Tell Vedant in one plain-English sentence what changed for the website.
5. Wait for Opus (§4b). Do not start the next task until Opus's message says so.

## 4b. Relay with Opus (no copy-paste by Vedant)

- **You → Opus:** append a `=== REPORT FOR OPUS ===` block to `.relay/to-opus.md` (end of a task, or `Result: QUESTION` when you are blocked and need a decision; one question per block, yes/no if possible).
- **Opus → you:** Opus appends `=== MESSAGE FOR HAIKU #<n> ===` blocks to `.relay/to-haiku.md`. Never edit that file.
- **Waiting:** right after appending a report, run `node scripts/relay-wait.mjs <TASK-ID>` as a **background** command (Bash tool with run_in_background). It exits when a new Opus message arrives and prints it. While waiting do nothing else (no new task, no exploring). If it exits with code 2 (timeout, 2 h), start it again once; after a second timeout tell Vedant in one line: "Waiting for Opus to review <TASK>."
- If Vedant types "check relay" (or similar), run `RELAY_TIMEOUT_MIN=0.05 node scripts/relay-wait.mjs any` **in the project folder** repeatedly until it says "No reply" — each run prints the oldest unhandled Opus message; act on each in order. This is a file in the repo, not a chat notification.
- If you cannot keep a background command running (for example you work through a remote shell with a time limit), check instead every 20 minutes with `RELAY_TIMEOUT_MIN=0.05 node scripts/relay-wait.mjs any` (using your scheduling tool: send_later / ScheduleWakeup / a loop). The script remembers which messages you already got (`.relay/.haiku-seen`).
- **Acting on a message:** `APPROVED` → mark the task `approved` in STATUS.md (in your next branch) and start the task named in `Next:`. `CHANGES` → fix exactly the listed items on the same branch, push, append a new report. `ANSWER` → continue the blocked task. `HOLD` → stop and wait again.
- If you have a `SendMessage` tool and `ListAgents` shows a session named `claude-aa`, you may also send the report there; the files stay the source of truth.
- Merging: only after `MERGE: allowed` for that exact PR + green CI (see §2 Git). If CI is red, do not merge: append a report with the failing job's last 30 log lines and wait.

## 5. Talking to Vedant

Vedant is non-technical. Use short, plain English. Ask at most one question at a time, ideally yes/no.
Never ask him to run commands you can run yourself. If he must do something by hand, give one step at a time.

## 6. Saving tokens (you are on a small model — be precise, not broad)

- Read files by line range when you know where to look; prefer `graphify` and `grep -n` over opening whole files.
- Never read `docs/prd/**`, `package-lock.json`, `.agents/skills/**` (except a skill the card names), `node_modules/**`, `.next/**`.
- Run the single related test file while iterating (`npx vitest run tests/server/<area>`), the full suite once at the end.
- Build once at the end, not after every edit.
- Do not paste large outputs into chat; summarise and keep evidence in `progress/<TASK>.md`.

## 7. Which docs win

`CLAUDE.md` and `docs/claude/*` override older docs. `docs/MASTER_PLAN.md` (the "Ana" plan), `PROGRESS.md`, `docs/deploy.md` (Vercel) and `docs/design/CLONE_SPEC.md` are **history**: read them only when a card points to a section.
Still valid: `AGENTS.md` content policy, `docs/contracts/*` (API + data model), `docs/CODE_MAP.md` §9–10.

## 8. Skills you have

- **Karpathy guidelines** — always on: think before coding, simplicity first, surgical changes, goal-driven checks.
- **Graphify** — code map. Run `graphify update .` after your changes, before the PR. Never commit `graphify-out/`.
- **Open SEO skills** (optional; not installed unless Vedant installs them) — if present, use ONLY `keyword-research`, `keyword-clustering`, `competitor-analysis`, `competitive-landscape`, `webapp-testing`, `seo-coach` (read-only advice). Do NOT use `merge-ready`, `openseo-release-notes`, `maintain-greptile-rules`, `papercuts`, `link-prospecting` — they push, release or contact people.
- **Marketing skills** in `.agents/skills/` — read one only when the card names it (`seo-audit`, `programmatic-seo`, `schema`, `site-architecture`, `copywriting`, `ai-seo`).
- **frontend-design** (if installed) — only for design cards.

Never invent SEO numbers (search volume, difficulty, traffic). If a tool did not return a number, write `unknown`.
