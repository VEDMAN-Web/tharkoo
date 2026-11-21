# Tharkoo — STATUS (shared between Opus and Haiku through GitHub)

**Current task:** none. All open cards are closed (21 Nov 2026, Opus with Vedant): the site is live on www.tharkoo.com.
**Next:** wait for a new card from Opus. Do not start any old "todo" card below; they were built in later tasks (H3–H18) or dropped.
**Waiting on Vedant:** nothing for Haiku.

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
| H0.2 | Windows-compatible scripts and tests | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H0.3 | Remove competitor reference material | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H1.1 | robots.txt one rule set | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H1.2 | Metadata always in head | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H1.3 | Crawler-safe rate limiting | closed (built in later tasks or dropped, 21 Nov 2026) | – | line-by-line |
| H1.4 | Same-name district pages | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H1.5 | Home: one clean H1 | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H1.6 | Title/description lengths | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H2.1 | Keyword and SERP evidence | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H3.1 | Admin shell + UI kit (Playzoni-style) | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H3.2 | Block engine | closed (built in later tasks or dropped, 21 Nov 2026) | – | line-by-line |
| H3.3 | Media library | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H3.4 | Home page fully dynamic | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H3.5 | Listing pages fully dynamic | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H3.6 | Post-ad page dynamic + category fields | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H3.7 | UI text dictionary | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H3.8 | Listing order control | closed (built in later tasks or dropped, 21 Nov 2026) | – | line-by-line |
| H3.9 | Dashboard | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H4.1 | SEO rules module + audit runs | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H4.2 | SEO overview + Pages & issues | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H4.3 | SEO templates + SERP preview | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H4.4 | Page overrides + bulk CSV | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H4.5 | Redirects & 404 monitor | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H4.6 | Indexing rules & sitemaps | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H4.7 | robots, llms & schema settings | closed (built in later tasks or dropped, 21 Nov 2026) | – | – |
| H16.2 PR 3 | New ad addresses, third part | merged (nothing to build: PR 1 and PR 2 did the work) | PR #450, PR #455 | approved by Opus |
| GATE | Vedant decisions D1–D6 → Opus writes SEO_PLAN v2 + H5 (content) / H6 (redesign) / H7 (launch) cards | closed (decided and built) | – | – |
| H18.1 | PassimPay crypto checkout (Haiku version) | closed, replaced by H18.1b | PR #466 closed | superseded |
| H18.1b | PassimPay crypto checkout | merged | PR #469 | Opus |
| H18.1c | PassimPay notices through the origin check; credits on return | merged | PR #470 | Opus |
| H18.2 | Google sees only real-ad pages | merged | PR #468 | Opus |
| H18.3 | Category delete removes its ads | merged | PR #467 | Opus |
| H18.4 | Ads sitemap in files of 10,000 | merged | PR #471 | Opus |
| H18.5 | Unpaid crypto orders close after 2 hours; tracker closed | PR open | haiku/h18.5-crypto-expiry | Opus |

Status values: todo · doing · PR open · changes needed · approved · merged · blocked.
