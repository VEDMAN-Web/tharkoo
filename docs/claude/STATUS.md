# Tharkoo — STATUS (shared between Opus and Haiku through GitHub)

**Current task:** H1.1
**Next after review:** H1.2 (order: H1.1-H1.6, then H0.2, H0.3)
**Waiting on Vedant:** decisions D1–D6 (docs/claude/SEO_PLAN.md §1) — needed before H5 (content) and H6 (redesign), not before H1–H4.

## How the two chats stay connected (relay, no copy-paste)

Opus has access to this folder on Vedant's PC. Messages go through `.relay/` (git-ignored):
1. Haiku finishes a task → pushes branch + `progress/<TASK>.md` → appends a report to `.relay/to-opus.md` → waits with `node scripts/relay-wait.mjs <TASK>`.
2. Opus reads the report and the branch in this folder, reviews, and appends `MESSAGE FOR HAIKU #n` (APPROVED / CHANGES / ANSWER) to `.relay/to-haiku.md`.
3. The waiting script wakes Haiku, which continues. Vedant only merges PRs (until he allows otherwise).

## Task table

| Task | Title | Status | Branch / PR | Opus review |
|---|---|---|---|---|
| H0.0 | Setup and baseline | approved | none (baseline) | approved by Opus 11 Nov |
| H0.1 | Workflow plumbing | merged | PR #27 | approved by Opus |
| H0.2 | Windows-compatible scripts and tests | todo | – | – |
| H0.3 | Remove competitor reference material | todo | – | – |
| H1.1 | robots.txt one rule set | todo | – | – |
| H1.2 | Metadata always in head | todo | – | – |
| H1.3 | Crawler-safe rate limiting | todo | – | line-by-line |
| H1.4 | Same-name district pages | todo | – | – |
| H1.5 | Home: one clean H1 | todo | – | – |
| H1.6 | Title/description lengths | todo | – | – |
| H2.1 | Keyword and SERP evidence | todo | – | – |
| H3.1 | Admin shell + UI kit (Playzoni-style) | todo | – | – |
| H3.2 | Block engine | todo | – | line-by-line |
| H3.3 | Media library | todo | – | – |
| H3.4 | Home page fully dynamic | todo | – | – |
| H3.5 | Listing pages fully dynamic | todo | – | – |
| H3.6 | Post-ad page dynamic + category fields | todo | – | – |
| H3.7 | UI text dictionary | todo | – | – |
| H3.8 | Listing order control | todo | – | line-by-line |
| H3.9 | Dashboard | todo | – | – |
| H4.1 | SEO rules module + audit runs | todo | – | – |
| H4.2 | SEO overview + Pages & issues | todo | – | – |
| H4.3 | SEO templates + SERP preview | todo | – | – |
| H4.4 | Page overrides + bulk CSV | todo | – | – |
| H4.5 | Redirects & 404 monitor | todo | – | – |
| H4.6 | Indexing rules & sitemaps | todo | – | – |
| H4.7 | robots, llms & schema settings | todo | – | – |
| GATE | Vedant decisions D1–D6 → Opus writes SEO_PLAN v2 + H5 (content) / H6 (redesign) / H7 (launch) cards | waiting | – | – |

Status values: todo · doing · PR open · changes needed · approved · merged · blocked.
