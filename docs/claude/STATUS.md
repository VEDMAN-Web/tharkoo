# Tharkoo — STATUS (shared between Opus and Haiku through GitHub)

**Current task:** H19.2, then H19.10, then H19.3, H19.4, H19.5, H19.6, H19.8, H19.9, H19.7. Cards in TASKS.md under "H19".
**Next:** after each H19 PR, report through the relay and start the next H19 card only when Opus says so. Do not start any old "todo" card below.
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
| H19.1 | Home, category, listing pages + view/click counts | approved (#487) | — | Haiku |
| H19.2 | Ad page | approved (#488) | — | Haiku |
| H19.3 | Video call flow for users | approved | — | Haiku |
| H19.4 | Buying credits: one kind at a time | approved | — | Haiku |
| H19.5 | Account menu by role + Video calls page | approved | — | Haiku |
| H21.8 | Remove the ad price everywhere | approved (#503 merged) | #503 | Haiku |
| H19.6 | Post an ad, rebuilt (part A of 2: layout, place, description, interests, photos) | approved (#497 merged) | #497 | Haiku |
| H19.6b | Post an ad, part B (contact, Free/TOP/Super Top, live screen, Promote pop-up, 70/30 note) | PR open | haiku/h19.6b-post-ad-pay | Haiku |
| H19.7 | Block throwaway emails | approved | — | Haiku |
| H19.8 | Video call switch and price inside each category | approved | — | Haiku |
| H19.9 | Vendor payouts in more coins + live-rate range | approved (#492 merged) | #492 | Haiku |
| H19.10 | Video call earnings split 70/30, vendors told everywhere | approved (#490) | — | Haiku |
| H20.1 | Tell Google the site name is Tharkoo | approved (#501 merged) | #501 | Haiku |
| H21.0 | Post-ad redesign: shared shell | approved (#504 merged) | #504 | Haiku |
| H21.1 | Post-ad redesign: Step 1 Category | approved (#505 merged) | #505 | Haiku |
| H21.2 | Post-ad redesign: Step 2 Details | approved (#506 merged) | #506 | Haiku |
| H21.3 | Post-ad redesign: Step 3 Photos | PR open | haiku/h21.3-photos | Haiku |

Status values: todo · doing · PR open · changes needed · approved · merged · blocked.
