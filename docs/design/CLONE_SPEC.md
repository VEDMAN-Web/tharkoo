# Tharkoo CLONE_SPEC (T9.1): replicate the reference layout and flow, in a premium light theme

Author: Ana. Version 1, 11 Nov 2026. Inputs: 44 reference captures (cited by file name (png in the raw set, webp in docs/design/ref/)), the capture notes, the old main UI, branch `cursor/t8.1-premium-design` (head feeab92).
"REF" means the reference site captured in those screenshots. Pixel sizes below were measured on the 1920x1072 captures (the screenshot viewer shows them at 1024 px, so numbers here are the real CSS px) and on the 390 px mobile captures. The word "about" marks a measurement within 3 px.

## 0. What this round changes and what it keeps

### 0.1 Rules of T8.1 that this round REVERSES (the coder must undo them)
1. "Dark UI is the only theme, `color-scheme: dark`" becomes **light only**: `color-scheme: light`. No dark or black surfaces anywhere, including footer, hero, panels, gallery letterbox, admin.
2. "Do not copy the competitor's layout" becomes **copy the layout, section order, button and label wording, spacing rhythm, hover and motion behaviour and page flow of REF**.
3. Midnight and champagne tokens, the gold gradient, `--grad-hero`, the sticky blurred header, the 1200 px container, the header "Centre search field", the city pill, the Save heart in the header, the category chip row under the header, the two-column ad detail with a sticky contact card, the "Premium classifieds, across India." hero and the list/grid card design are all **replaced** by the REF equivalents in section 2.
4. `rg "sk-|item-card|btn-post|btn-ghost|--sk" src` must return nothing is **dropped**. New classes use the prefix `tk-` (see brief).

### 0.2 Rules that STAY (do not regress)
- No fake data and no developer text on any page. Empty states are honest.
- Contact numbers are never in the initial HTML; `Call` and `WhatsApp` reveal on click through `POST /api/listings/{id}/contact-reveal`.
- Neutral age-gate and cookie copy. Minimum text size 12 px. One `<h1>` per page. Unique `<title>`, canonical and Open Graph tags (see `pageMetadata`).
- Real auth, real post-ad drafts, admin login, `STAGING_AUTO_VERIFY_EMAIL`, search synonyms, the proxy rate-limit fixes, `prefetch={false}` on big link grids.
- Placeholder images only (`public/placeholders/**`, `PlaceholderArt`, `SmartImage`). Never REF photos.
- Content policy: copy structure and UI wording, but category names and every piece of descriptive copy use Tharkoo's own policy-safe set (section 3). Nothing sexual, explicit, or paid-companionship wording in text, alt text, class names, test data or filenames.
- Fonts via `next/font` only; no new dependencies.

### 0.3 Known deliberate deviations from REF (each is listed again in the acceptance checklist)
| # | REF has | Tharkoo does | Why |
|---|---|---|---|
| D1 | Five category photo cards with adult-services names and photos | Five photo cards with Tharkoo's categories and neutral placeholder photos | policy |
| D2 | Body and service filter groups and chip sets | Filters built from Tharkoo's own category fields and neutral toggles | policy |
| D3 | Third-party banners between ads | A house "Promote your ad" band in the same slot | policy and no third-party ads |
| D4 | Cloudflare "Success!" widget in the post form | Omitted (no new dependency; server-side rate limit stays) | dependency rule |
| D5 | "RTA RESTRICTED TO ADULTS" badge, payment-card logos | A neutral "18+ ONLY" badge, no card logos | trademarks |
| D6 | Footer "Company" links to sister sites | "About Tharkoo" and "Contact us" | not ours |
| D7 | Social icons in footer and drawer | Shown only when `site.socialLinks` holds a real URL (T8.1 rule P1-9) | no fake links |
| D8 | Dark navy gallery letterbox, dark grey footer bar, dark hero edge | Light ivory letterbox, blush footer bar, mid-tone plum hero | Ved: no dark theme |
| D9 | Two-person logo mark and the name | Tharkoo wordmark and a new two-arch mark | brand |
| D10 | Real photo hero | Neutral placeholder hero image under the gradient | placeholders |

## 1. Global chrome and shared components (applies to every page)

Measurements: desktop = 1440 to 1920 wide. The page content column is a **960 px container** (`.tk-container`, `width:min(960px,100% - 30px)`, margin auto; 15 px gutters; at <=991 px the width is `100% - 30px`). The hero text and nothing else uses a wider 1320 px container. Page background is white on REF; Tharkoo uses the ivory token (section 4).

### 1.1 Header (`01_home_desktop_1.png`, `02_city_listing_desktop_1.png`, `20_home_mobile_390.png`)
- NOT sticky (scrolls away). Height about 76 px desktop (logo block 44 px plus 16 px top and bottom padding), 82 px mobile. 1 px bottom border `--border`. White background.
- Left: logo lockup. Mark (28 px, two overlapping rounded arches, plum and rose) followed by the wordmark "tharkoo" (display font 700, 28 px, plum). Under the lockup a 11 px bold grey line "India". On city, category and ad pages a second grey 10 px line shows the current city name (REF shows "Mumbai"). The lockup is a link to `/`.
- Right on `/` , `/cities/`: search icon button (24 px line icon, 50x50 hit area), account icon button (20 px filled person, 50x50), and the primary button **POST YOUR AD** (plum fill, white text 14 px, weight 500, uppercase, radius 8 px, padding 10x18, about 82x36). Mobile (<=991 px): search icon, account icon, hamburger icon (24 px, three lines), no POST YOUR AD in the bar (it moves into the drawer and under the hero on `/`).
- On listing, ad, vendor and form pages the search icon is NOT shown on desktop (account icon plus POST YOUR AD only); on mobile all three icons stay. On vendor pages the account icon shows the user's name under it in 11 px rose text (truncated with an ellipsis after about 10 characters), and a blurred pink glow is REF's privacy mask, not copied.
- Account icon opens a small dropdown (REF behaviour): width 200 px, white, 1 px border, shadow, rows 14 px: Log in, Register (signed out) or Dashboard, Your ads, Wallet, Settings, Log out (signed in). Hover row `#F7F1F4`.
- Clicking the search icon opens the search modal (section P09). Clicking the hero search pill on `/` also opens it.

### 1.2 Mobile drawer (`21_mobile_menu_open_390.png`)
Slides in from the right over the dimmed page. Panel width 277 px (about 71% of 390), full height, white, top padding 56 px, left padding 20 px. Close icon (26 px thin X, grey) at top right (18 px from the edges).
Content in order, all left-aligned, label rows 16 px grey `--muted`, item rows 16 px charcoal with a 24 px line icon and 16 px gap:
1. Label "Publish ad". Button **POST YOUR AD** full panel width (about 235x50, plum, radius 10 px, 16 px uppercase).
2. Label "Services for you!". Rows: "Tharkoo Blog" (chat icon) -> `/blog/`, "Help Center" (question icon) -> `/help/`.
3. Label "Follow us" with rows Instagram, Twitter, Tiktok, Bluesky (D7: only the ones that have a real URL; hide the label if none).
Motion: panel `transform: translateX(100%)` to `0` in 300 ms ease-out; backdrop opacity 0 to .5 in 300 ms; body scroll lock; Esc and backdrop click close; focus trap; restores focus.

### 1.3 Footer (`01_home_desktop_2.png`, `04_ad_detail_desktop_4.png`, `06_vendor_dashboard_desktop_full.png`)
Order top to bottom (everything inside the 960 container except the last bar):
1. Hairline `--border`, then the brand row: left the logo lockup (28 px mark) with under it a grey rounded badge **18+ ONLY** (D5; 11 px bold, bg `--chip`, radius 12, padding 4x8); right (starting at 384 px from the container left, about 580 px wide) the about text, 14 px light grey: "Tharkoo is a classifieds platform for people in India. Browse new listings every day in {n} cities." with the number in rose bold.
2. Four link columns (equal width, 14 px): column heads 14 px bold charcoal; links 14 px weight 300 grey, 2 px vertical padding. Legal: Terms and Conditions, Privacy Policy, Cookie Policy. Support: Help Center, Submit a Report, Blog. Security: How to report a scam. Company: About Tharkoo, Contact us.
3. Two columns: left "Boost your visibility" (14 px bold) with a full-width plum button POST YOUR AD (52 px tall, radius 6); right "Countries" with a full-width select, 1 px border, radius 18, 14 px text, showing "India" with a flag emoji and up/down arrows; it has the single option India (nothing else exists yet).
4. A grey 12 px line with the legal name from `site.legalName` (no card logos, D5).
5. Full-width bottom bar, 150 px tall: background blush `--bar` (D8), centred social icon row (only real URLs, 24 px, plum, 32 px gap) and under it "Copyright 2026 © Tharkoo" in 12 px plum. A white pill **Back to top ↑** (12 px, radius 30, padding 12x24, 1 px border, shadow) overlaps the top edge of the bar on the right; it shows after 300 px of scroll (REF shows it only at page bottom) and scrolls smoothly.
Mobile: columns become two per row; the brand row stacks; the select and the button stack.

### 1.4 Breadcrumb and "Back to search" (`04_ad_detail_desktop_1.png`, `23_ad_detail_mobile_390_1.png`)
- Optional first row (ad pages only): "< Back to search" rose 13 px (mobile 16 px), 1 px hairline under it with 10 px padding.
- Breadcrumb row: rose 11 px (mobile 14 px) links separated by a grey " / "; last item is a link too. Items on category pages: "Tharkoo India / {Category} / {State} {Category} / {City} {Category} ▾" and on ad pages "... / {District} {Category}". The last item on a listing page has a caret and opens a small dropdown of sibling districts (links). Wraps to several lines on mobile; on listing pages mobile shows only one rose link "{City} {Category} ▾" instead of the trail (REF `22_*`).

### 1.5 Buttons (all exact)
| Name | Look | Used for |
|---|---|---|
| tk-btn-primary | plum fill, white 14 px/500 text, radius 8, height 36 (hero/footer variants 52), uppercase | POST YOUR AD, footer POST YOUR AD, drawer POST YOUR AD |
| tk-btn-rose | rose fill, white 14 px, uppercase, radius 8, height 52 | SEARCH, GO ON, ACCEPT, phone button, BUY CREDITS (small: height 40, radius 4), PAY, SEARCH circle (round 40) |
| tk-btn-outline-rose | transparent, 1 px rose border, rose 13 px uppercase text, radius 6, height 40 | CONTACT US, CHANGE PASSWORD, "Show more", pills |
| tk-btn-outline-primary | transparent, 1 px plum border (REF: light blue), plum 13 px bold uppercase, radius 6, height 32 | APPLY (coupon) |
| tk-btn-whatsapp | green `--wa` fill, white 14 px, 52 px tall, radius 8, WhatsApp glyph left | WhatsApp |
| tk-btn-grey | `--chip` fill, grey text, radius 6, 40 px tall, icon left | support WHATSAPP and TELEGRAM when no number is configured |
| circle-contact | 44 px white circle, shadow, pink or green glyph | super-top card quick contact |
Hover: fill darkens one step in 150 ms (rose #8A2F4F, plum #561A41, green #0B6B3A); outline buttons fill with the 6% tint. Focus ring: 2 px `--focus`, offset 2 (accessibility, not in REF).

### 1.6 Cards and pills
- Listing card (section P04): white, radius 8, shadow `--sh-card`, 20 px top margin between cards.
- Pill chip ("button-pill"): 1 px rose border, rose 13 px bold text, radius 16, padding 10x20, bg white at 70%.
- Attribute chip (ad detail): white, 1 px `--border-2`, radius 5, 12 px/500 charcoal, padding 5x8 (REF 11 px; we use 12 px minimum).
- Filter chip (listing page, under the location search): bg `--tint`, 1 px `--border-2`, radius 8, 13 px, padding 8x14.

### 1.7 Age gate (`00_age_gate.png`)
Page behind is blurred (`backdrop-filter: blur(8px)`) with a 35% charcoal-plum overlay. Centred white dialog, about 500 px wide (max 100% - 32), padding 40x28, radius 12, centred text:
1. Round 44 px icon: two small people glyphs (plum and rose) in a white circle with a 1 px border and a rose "18+" pill badge at its top right.
2. Title bold 17 px charcoal: "Please confirm your age before continuing" (REF says "Please read the following warning before continuing"; the word warning is not kept).
3. Body 13 px: "**I am over 18 years old** and I accept the terms of use of this site." then a 13 px line "I have read and accept the [Terms and Conditions]" (rose link to `/terms/`).
4. Button **ACCEPT** (rose, uppercase 13 px, about 100x45, radius 8, centred). Under it a rose text link **Decline** (leaves the site, same target as the current "Leave").
Motion: backdrop fades in 250 ms, dialog fades and rises 12 px in 250 ms. Shown after mount, remembers the choice (cookie or localStorage as today). Focus trap.
Cookie notice (not captured in REF): keep the T8.1 compact bottom card restyled with the light tokens; "Accept all" (rose) and "Only necessary" (outline).

### 1.8 Motion (observed, and nothing else)
- Category cards on home: the photo scales 1.00 to 1.06 on hover in 400 ms ease inside an `overflow:hidden` frame (REF "subtle image zoom").
- Drawer, search modal, age gate, gallery modal: fade plus slide as above.
- Buttons and links: 150 ms colour transitions. Link hover underline.
- Listing cards: no hover motion in REF; add only a 1 px shadow deepening (150 ms).
- FAQ accordion chevron rotates 180 degrees in 200 ms; toggle switches slide in 150 ms.
- Shimmer on image placeholders while loading. `prefers-reduced-motion: reduce` disables all transforms and sets transitions to 0.01 ms.

## 2. Page by page

Format per page: **Route**, **REF files**, desktop sections top to bottom (sizes, text), mobile, behaviour, flow, data. "Text" in quotes is the exact UI string. Where REF wording is explicit, the Tharkoo replacement is given.

### P01 Home
- **Route** `/` (file `src/app/page.tsx`, `src/components/HomeBlocks.tsx`, `HeroCity.tsx` deleted or replaced by `HeroSearch`).
- **REF files** `01_home_desktop_1.png`, `01_home_desktop_2.png` (full page), `00_age_gate.png` (overlay), `20_home_mobile_390.png`, `21_mobile_menu_open_390.png`, `24_search_popup_mobile_390.png`.
- **Desktop, top to bottom**
  1. Header (1.1), 76 px.
  2. Hero band: full width, height `70vh` (about 750 px at 1072 px viewport, max 880, min 425; 50vh from 992 to 1199, 425 px at 768 to 991, 488 px at 600 to 767, 290 px below 600). Background: horizontal gradient from deep plum at left through rose-plum to warm rose at right (token `--grad-hero`), with a neutral placeholder photo (`/placeholders/hero.webp`) on the right 42% of the band, `object-fit: cover`, `object-position: top`, soft luminosity blend, left edge fading into the gradient with a mask. Tagline at the left, vertically centred in the upper two thirds: H1 "Single? Taken? Doesn't matter, Tharkoo is for everyone" in the display font 600, white, about 48 px, line height 1.15, max width 724 px, left edge at `(100vw - 1320px)/2 + 7px` (about 307 px at 1920; 15 px gutter below 1400). Search pill: inside the 960 container, 114 px above the band bottom, height 62 px, white, radius 31 px, soft shadow `0 2px 20px rgba(106,33,80,.15)`, centred 14 px bold grey text "Search By City, Category..." and a 20 px thin search icon at the right (24 px from the edge). The pill is a button; click opens the search modal. No border on desktop (T8.1 had 2 px).
  3. Section title block, centred, 48 px below the hero: H2 "Hot meetings in your city" (display font 600, 30 px desktop, 24 px mobile, charcoal), under it a 16 px light grey line "Find your favourite listings on Tharkoo", then 50 px gap.
  4. Category card grid: 3 columns of 300 px with 30 px gaps inside the 960 container; 2 columns from 768 to 991; 1 column below 768. Exactly five cards (D1, section 3): the first three in row one, two in row two, left aligned, the sixth cell stays empty. Card = white, radius 10, shadow `--sh-card`, `overflow:hidden`, 8 px bottom margin. Photo area 201 px tall (placeholder photo of that category from `public/placeholders/{slug}/01.webp`, cover), whole area is a link to `/{category}/`; bottom-left over the photo (18 px from the edges) a white 24 px bold title (display font, text shadow `0 0 20px rgba(0,0,0,.5)`) preceded by a 20 px white line icon; a bottom gradient (transparent to 45% charcoal, 90 px) keeps the text readable. Body padding 10x20x16: a 14 px grey description (3 lines max) then three bordered rows (1 px `--border-2`, radius 10, padding 10x0x10x15, 10 px apart) each a link `/{category}/{city}/`: top line the category name in 14 px grey, second line the city name in 14 px bold rose. The three cities are the first three `homeCities` of the category (fallback: top cities). Hover on the card photo: image zoom (1.8).
  5. SEO paragraph, centred, 12 px grey, max width 860 px, 48 px above: the site SEO intro (`seo.intro`), links inside in rose.
  6. Hairline, then five white "city group" cards (radius 8, shadow, padding 20, centred, 8 px apart): head = 16 px line icon plus category name in 20 px/600 charcoal-link (link `/{category}/`); below, a centred wrap of pills (1.6) each a city link `/{category}/{city}/`: the five top cities plus, on the first card only, a pill "All cities" -> `/cities/`. A sixth card "More categories" shows one pill per remaining category (Jobs, Property, Vehicles, Buy and sell, Pets, Education) (section 3). Do not render more than 6 pills per card (link count discipline); `prefetch={false}`.
  7. Footer (1.3).
- **Mobile (390)** `20_home_mobile_390.png`: header 82 px with three icons; hero 290 px tall with the placeholder photo behind the right 55%; H1 20 px/1.2 bold white, left at 40 px, width 70%, four lines (fixed line breaks are fine: "Single? Taken?" / "Doesn't matter," / "Tharkoo is" / "for everyone"); search pill at 253 px from the top, 345 px wide (15 px gutters), 64 px tall, radius 32; text 15 px bold grey centred. Below the hero a full-width **POST YOUR AD** plum button, 49 px tall, radius 10, 16 px uppercase, margin 30 px top (hidden from 720 px up). Title 24 px, subtitle 16 px. Cards stack, photo 201 px tall, overlay title 24 px, body 16 px description, row links 16 px.
- **Flow** card photo/title -> category page; city row -> `/{category}/{city}/`; pill -> same; search pill -> modal -> `/search/` or `/{category}/{city}/`; POST YOUR AD -> `/u/post-insert/` (redirects to login when signed out, then back).
- **Data** `getCategories`, `getTopCities`, `getSite`, `getSeo` (read-only helpers). Card text from `category.homeBlurb`, else the neutral fallback texts of section 3.

### P02 City directory
- **Route** `/cities/` (`src/app/cities/page.tsx`).
- **REF files** `02_city_directory_desktop_1.png` to `_4.png`, `02_city_directory_desktop_full.png`.
- **Desktop**: header (logo only is acceptable; keep search, account, POST YOUR AD for consistency). Banner: full width, 116 px tall, flat plum (`--primary`, REF flat magenta) with large faint map-pin outlines (white at 12%) at the far right; left aligned in the 960 container, H1 "Tharkoo India" 30 px normal weight white (display font 600). Under it a panel in the 960 container: 1 px `--border-2`, radius 4, margin-top 26. Panel head: grey `--chip` bar 31 px tall with a flag emoji and "INDIA" (14 px, letter-spaced). Body: for each state a rose 13 px link (padding 15 px left), then its cities indented 24 px, each row 49 px tall with a 1 px `--border` rule, rose 13 px; large cities show their districts indented a further 24 px, rows 49 px, 13 px. Everything in one narrow column. State names that have no listings still render (links). Links go to `/{topCategory}/{city}/` and `/{topCategory}/{city}/{district}/`; use `prefetch={false}`; the district lists are rendered for the top 10 cities only.
- **Mobile**: same single column, banner 90 px, H1 24 px.
- **Data** `getCities`, `getDistricts`, `getLocationBySlug`.

### P03 Category hub
- **Route** `/[category]/` (REF has no capture; use the P02 pattern). Banner title "{Category} in India"; panel lists states then cities that have the category; same styling as P02. Under the panel the SEO intro (12 px grey). Breadcrumb "Tharkoo India / {Category}".

### P04 City listing (photo cards) and P05 category plus city (text cards)
- **Routes** `/[category]/[location]/` (city) and `/[category]/[location]/[district]/` (district); `/search/` reuses the layout. Files `src/components/ListingPage.tsx`, `src/components/ui/AdCard.tsx` (and the re-export `src/components/AdCard.tsx`).
- **REF files** `02_city_listing_desktop_1.png`, `_2`, `_3` (photo cards, in-feed banner), `03_category_city_text_cards_1.png`, `_2` (mostly text cards), `22_city_text_cards_mobile_390_1.png`, `_2`.
- **Desktop top to bottom** (all in the 960 container)
  1. Header (1.1) with the grey city name under the logo.
  2. Location selector: a 52 px tall field, white, 1 px `--border-2`, radius 10, a 16 px pin icon on the left (12 px from the edge), text "{State} - {City}" 14 px/500 charcoal at 28 px, and at the right a 34 px round rose button with a white search icon (10 px from the edge). The whole field opens the search modal (not an inline input). In REF it is 513 px wide inside the column.
  3. Tag chips row (filter chips, 1.6) 12 px below: up to four real links (REF: four hashtag-style chips). Tharkoo: "Verified" (`?verified=1`), "With photos" (`?photos=1`), then up to two district links of this city; the selected chip uses `--tint-rose` with a rose border and bold rose text. Real `<a>` links.
  4. Hairline `--border`, then breadcrumb (1.4) 12 px, then the page title as plain text: H1 "{Category} {City} ({State})" at 16 px weight 400 charcoal (REF text is the H1; visually small, semantically h1; the SEO template text stays the source).
  5. Card feed, single centred column, cards 960 wide, 20 px apart. Card anatomy:
     - Container: flex row, white, radius 8, shadow `--sh-card`, overflow hidden, min height 125 (text card) / 234 (top) / 302 (super top).
     - Photo (variants top, highlight, super top only): left, 160 px wide (140 below 768), full card height, cover, placeholder photo; bottom-left chip "📷 N" (dark translucent `rgba(31,36,51,.72)`, white 11 px bold, radius 4; D8: allowed because it sits on a photo); super top shows round 32 px white prev and next arrows over the photo (16 px from the photo edges) which change the photo.
     - Content: padding 15x16x12, min-width 0. Title 18 px/22 weight 800 rose link (2 lines max, ellipsis), 10 px under it; description 14 px/1.4 navy-charcoal (`--text`) 3 lines max (4 lines on text cards); a 10 px gap then two meta rows at the bottom: row 1 a 12 px calendar icon plus "{age} years" bold 12 px (shown when `ad.age`; otherwise the category label), row 2 a 12 px pin icon plus "{City}/ {District or place}" with the city bold (REF text "Mumbai/ Andheri", keep the format "City/ Area"), truncated with "..." after 22 characters.
     - Promotion badge, top-right corner, 10 px bold with a small icon: **Top** (plum text, small plum arrow icon) on top cards and **SUPER Top** on super top cards. Super top: 2 px plum border all around, and bottom-right two circle buttons (44 px, 12 px apart, 12 px from the edges): phone (rose glyph) and WhatsApp (green glyph), both reveal on click (never show a number). Highlight: tint-rose background, no extra badge. Free (no variant): no photo, no badge, text spans the full width (this is the REF text-only card of `03_*`).
     - Whole card is one link (single `<a>` stretched) to `/ad/{slug}/`; the circle buttons sit above the link.
  6. After every 6th card insert the house band (D3): full width 960x150, radius 8, rose-to-plum gradient, left text "Reach more people" 24 px display font white and sub "Promote your ad and stay at the top." 14 px, right a white button **POST YOUR AD**. Not a third-party ad. The band is a real link, not a script slot.
  7. Under the feed a centred **Show more** button (outline rose, 40 px, min width 180, radius 20) as a real link `?page=N+1` with `rel="next"` (REF loads more; the link keeps SEO). Hidden on the last page. When there are zero results show the EmptyState with "Post the first ad".
  8. SEO text block: `seo.footer` or intro, 12 px grey, 32 px above the footer; related cities/categories as small rose links (max 8).
  9. Footer.
- **Mobile**: location selector 345x52; breadcrumb collapses to the single rose link "{City} {Category} ▾" (13 px) with hairlines above and below; H1 16 px; cards full width (345), padding 16, title 18 px/1.25 rose bold (up to 4 lines), description 16 px/1.4 (4 lines), meta rows 12 px; photo cards put the photo at the left at 110 px wide (not captured in REF; stated as an assumption); super top card keeps the two circle buttons. Cards 24 px apart.
- **Flow** card -> ad detail; breadcrumb -> hubs; chips -> filtered same route; location field -> search modal.
- **Data** `getFeed`, `getStarListings` (render star listings as super top cards at the top of page 1 with the label "Star" in the badge slot), `getRelated`, `isThin` (keep noindex logic).

### P06 Ad detail
- **Route** `/ad/[slug]/` (`src/app/ad/[slug]/page.tsx`, `src/components/AdDetail.tsx`, `ContactButtons.tsx`, `ui/Gallery.tsx`).
- **REF files** `04_ad_detail_desktop_1.png` to `_4.png`, `23_ad_detail_mobile_390_1.png`, `_2`.
- **Desktop top to bottom** (single 960 column, no sidebar)
  1. Header; then "< Back to search" (1.4) linking to the previous list (`history.back()` when same-origin, else the category/city page); then the breadcrumb (5 levels).
  2. Date line: 10 px bold grey uppercase "11 NOVEMBER" (the published date, day and month) followed by " - Ad ID: {publicId}" in 10 px regular; 9 px above the card.
  3. Summary card: 1 px `--border-2`, radius 12, padding 16, margin-bottom 12. Row 1: nickname (`displayName`) rose 20 px/600 on the left; promo badge "SUPER Top" or "Top" or "Verified" on the right (plum 12 px bold with icon). Row 2 pills: [person icon + "{age} years"] and [pin icon + "{City} / {District}" with the city bold]; each 1 px border, radius 8, 13 px, padding 4x8. Row 3: the ad title 18 px/1.3 regular charcoal. Row 4 buttons: **Call** (rose, 225 px wide, 52 tall, radius 8, phone icon) and **WhatsApp** (green, same size) 15 px apart, left aligned; Telegram appears as a third blue button when set. Reveal on click.
  4. Gallery (REF `04_ad_detail_desktop_2.png`): up to four images in a mosaic of unequal tiles (three across on top row at about 320 px wide, the fourth at right below) on a light ivory letterbox (D8), 15 px gutters, clicking any opens the full gallery (P07). Our layout: a row of up to 3 tiles (equal 320x400 `object-fit: contain` on `--letterbox`) plus a 4th below at right; with fewer photos the tiles centre. Zero photos: one neutral PlaceholderArt tile and the text "No photos yet".
  5. Section "About me" (heading icon smile, 18 px bold; for non-personal categories the label is "About this ad"): body text 14 px/1.6 `--text`, white-space pre-wrap, max width 100%.
  6. Chips row (attribute chips, 1.6) for the first group of tags (REF: two chips).
  7. Hairline, then sections each with a 18 px bold heading plus 16 px line icon and chips: "Services" (heart; neutral label per category, section 3), "Attention to" (person; shown only for the four personal categories), "Place of service" (map; label "Where" for non-personal). Sections with no data are hidden (no empty headings).
  8. Hairline, centred H3 "Contact me" (24 px display font, 32 px margins), then two centred buttons 300x54 (Call, WhatsApp) with 15 px gap, again reveal on click. (REF repeats the buttons.)
  9. Hairline; row of two halves: left centred "Share ad" (16 px bold) with two 22 px rose icons (X and WhatsApp; share links, open new tab with `rel="noopener noreferrer"`); right centred "🛡 Report abuse or fraud" rose 14 px link -> `/submit-report/?ad={publicId}`.
  10. Centred 18 px line "All ads in **{Category} in {City}** ›" (rose bold part) -> `/{category}/{city}/`.
  11. Security tips panel: plum (`--primary`) rectangle, radius 8, padding 28x40x20, centred text; a gold-rose tab "SECURITY TIPS" (10 px bold, gold bg, plum text, with a 22 px icon, overlapping the top-left corner by 12 px); H3 "Security tips" white 18 px bold; text white 13 px: "Be careful if the advertiser writes in an unusual way or asks for money in advance. Never share OTPs or card details."
  12. Four disclaimer paragraphs (12 px grey, max width 100%): own neutral text stating that Tharkoo does not intervene in relationships between users and advertisers, that ads are published on the advertiser's own responsibility, that Tharkoo does not verify content beyond its policy, and that the site offers publication and navigation services. First sentence bold. Related ads rail (T8.1 `Related ads`) is kept below as a plain list of up to 6 text cards (the same P04 card) under the heading "More like this" (keeps internal linking).
  13. Footer.
- **Mobile** `23_*`: "< Back to search" 16 px; breadcrumb wraps over three lines (14 px); date line 12 px; summary card padding 16: nickname 22 px, promo logo right, pills 15 px bold, title 24 px/1.25 regular; then the gallery is a single 390x395 frame on `--letterbox` with `object-fit: contain`, a pill **⤢ SHOW ALL** at its top right (white pill, plum 11 px bold, shadow; REF dark pill, D8) and the remaining photos as two thumbnails below; "About me" heading 22 px bold; text 16 px/1.5; chips; sections; "Contact me" block; **a fixed bottom bar** (white, 1 px top border, padding 10x8, z-index 20) holding Call and WhatsApp side by side (each about 175x50, radius 6, 15 px gap); content gets 80 px bottom padding; the cookie card sits above the bar.
- **Flow** Call/WhatsApp -> reveal then open `tel:`/`wa.me`; SHOW ALL -> P07; report -> `/submit-report/`; "All ads in" -> city listing.
- **Data** `getListingBySlug`, `getRelated`, `listingTagSections`, JSON-LD stays.

### P07 Gallery modal ("Show all")
- **Route** client overlay on `/ad/[slug]/`. REF has the action only (`23_ad_detail_mobile_390_1.png`). Spec: full-screen white sheet (z-index 90), top row rose bold "< Back" (17 px), then all photos stacked, full width, 8 px gap; Esc and Back close; swipe not required. Fade 200 ms.

### P08 Search modal and results
- **Route** global overlay (`src/components/SearchModal.tsx`), results at `/search/`.
- **REF files** `05_search_modal_desktop.png`, `24_search_popup_mobile_390.png`.
- **Desktop modal**: centred horizontally, top margin 28 px, width 800 px, height about 710 px (max 100vh - 56), white, radius 12, shadow `0 8px 32px rgba(0,0,0,.18)`, page behind dimmed to 45%. Head: 44 px, grey `--chip` bar, a 14 px search icon and "Search" 16 px bold at the left, a thin X at the right (16 px). Body padding 16: row 1 two equal fields: a category `select` ("Dating", the first category preselected; up/down arrows) and a text input placeholder "Search here..."; row 2 three selects "Select Region", "All the cities", "Select District" (the third is disabled and greyed until a city is chosen). All fields 38 px tall, 1 px `--border-2`, radius 4, 12 px text, gaps 12. Then a row "☰ Filters" (12 px bold, 20 px icon) and a list of expandable rows (50 px tall, icon + 14 px label at the left, 14 px rose chevron at the right, hairline between). Tharkoo rows (D2): "Verification" (option: Verified profiles only), "Photos" (option: With photos only); then up to four rows built from the chosen category's own filterable select fields (for example "Looking for" for Dating). Expanding a row shows its options as filter chips (1.6) inside the row; the chevron rotates 90 degrees. Footer bar (sticky, white, hairline): left half **DELETE ALL** (rose text, 13 px uppercase, resets the form), right **SEARCH** (rose fill, 330 px, 40 px, radius 8, 14 px search icon plus the word).
- **Mobile**: full-height overlay, same stack in one column; fields 40 px; filters rows 52 px; the footer bar fixed at the bottom with DELETE ALL and SEARCH side by side. Opens with a 250 ms fade and slide up of 16 px.
- **Behaviour**: category select and region select drive the city list (region -> `GET /api/locations?type=city`, filtered client-side by state); submit builds `/search/?q=&category=&city=&verified=1&photos=1` via a real GET form, except when a category and a city are chosen and the text box is empty, in which case it navigates to `/{category}/{city}/` (REF behaviour); keep recent searches (`tk-recent-q`) as a small row under the text box, keyboard accessible; Esc closes.
- **Results page** `/search/`: P04 layout with the location field showing the query and H1 "Results for “q”" (16 px).

### P09 Vendor dashboard
- **Route** `/u/account/dashboard/` (`src/app/u/account/dashboard/page.tsx`, `src/components/vendor/*`); `/u/account/` redirects here.
- **REF files** `06_vendor_dashboard_desktop_1.png`, `06_vendor_dashboard_desktop_full.png`.
- **Desktop** (header with the user name under the avatar icon): a 960 grid, left two columns of 260 px tiles (30 px gap), right column 382 px (30 px gap).
  - Tile anatomy: white, radius 10, shadow `--sh-card`, padding 15, height 231 for the 2x2 block: head row rose 18 px/700 with a 14 px line icon and a rose chevron at the right (whole tile is a link). Ads tile "Ads": rows "Active" and "Not published" (12 px charcoal) with a white 12 px bold count at the right (shadow chip). Wallet tile "Wallet": rows "Available" and "Used" with counts, and a small rose button **BUY CREDITS** (40 px tall, radius 4, 12 px uppercase) -> `/u/account/credits/`. Coupons tile "Coupons": "Manage your coupons". Settings tile "Settings": "Manage your personal info.".
  - Row 3 left: "Tharkoo News" tile (260 wide, padding 15): rose 13 px/600 title with a megaphone icon, a green check circle plus "Marketing communications active" (12 px), "You'll receive **exclusive offers, promotions, and news** from Tharkoo." Right of it a plum "Security tips" card (260 wide, radius 8, padding 28x16x20, centred white text): gold tab label "SECURITY TIPS" at the top-left, title 18 px bold, text 12 px "Scammers may pretend to be the Tharkoo team to ask for money. Never send payments or personal information to unofficial contacts.", then a gold bold 14 px link "Visit our Help Center to learn more." -> `/help/`.
  - Right column: a profile card (white, no border, radius 10, shadow, padding 15): display name, email in grey, a status chip (green "ID verified" or amber "ID check pending" or grey "ID not submitted") and a rose link "Verify your ID" -> `/u/account/kyc/` when not verified; below it a white card with 1 px border, radius 8, padding 12: a gold 30 px star icon, bold 12 px "Stand out with the new Star!", grey 12 px "Catch attention like never before. Promote your ad in a premium format that always puts you front and center." and underlined "Learn more" -> `/help/`.
  - Help card (section 1.9 below) full width under the grid, then the footer.
- **Mobile**: tiles stack in one column (full width, height auto), profile card first, then Ads, Wallet, Coupons, Settings, News, Security tips, Star card, help card.
- **Data** `GET /api/auth/me`, `GET /api/wallet`, `GET /api/listings` (own list). Counts are real; when an API fails, show "–" and no invented numbers. No fake numbers ever.

#### 1.9 Help card (shared by P09 to P14 and the post form)
White, 1 px `--border-2`, radius 10, padding 16x8, shadow `--sh-soft`. Row: "Do you need help?" bold 14 px and a 16 px headset icon at the right. Text 13 px grey "For **information** or **technical support**, click the button below." Full-width outline rose button **CONTACT US** with a small envelope icon (40 px tall) -> `/contact/`. Text 13 px grey "We are also available on **WhatsApp** or **Telegram** Monday through Friday, excluding holidays, from {site.supportHours}." Two equal grey buttons (`tk-btn-grey`): **WHATSAPP** and **TELEGRAM**; they become real links (`https://wa.me/{number}`, `https://t.me/{handle}`) when `site.supportWhatsapp` / `supportTelegram` exist, otherwise they stay inert greys (aria-disabled). Never print an invented number.

### P10 Your ads
- **Route** `/u/account/ads/`. **REF** `07_vendor_my_ads_desktop_1.png`, `07_vendor_my_ads_desktop_2_unpublished.png`.
- **Desktop**: H1 "Your Ads" (display font 600, 32 px, centred, charcoal, 22 px below header). Two equal tabs over a hairline (each 480 px): "Active" and "Not published", each with a tiny 10 px superscript count above the label; the selected tab has a 2 px plum underline and plum label, the other rose label; switching is client-side and updates `?tab=`. Under the tabs 14 px text "You have **0 active ads**" / "You have **0 not published ads**". When ads exist show them as P04 cards (text style) with action links under each: Edit, Pause, Renew, Duplicate, Delete (rose 13 px; each uses the existing listing endpoints; Delete asks a confirm dialog). Active = status live; Not published = draft, pending, rejected, paused, expired. Then the help card and footer.
- **Mobile**: same, full width.
- **Empty state** is the REF line itself ("You have 0 active ads") plus a rose link "Post an ad" -> `/u/post-insert/`.

### P11 Credits
- **Route** `/u/account/credits/` (history at `/u/account/credits/history/`). **REF** `08_vendor_credits_desktop_1.png`, `08_vendor_credits_desktop_full.png`.
- **Desktop**: H1 "Buy Credits" (display 600, 32 px centred). Balance card (white, 1 px border, radius 10, padding 15, 960 wide, 48 px tall plus text): a 40 px round coin icon at the left (plum ring), "**0** Available  **0** Used" (13 px) and a rose link "Transaction History" -> history page. Below, 26 px gap: a label "Do you have a Coupon?" (14 px, ticket icon, shifted right 35 px as in REF) and a coupon row: input (placeholder "Insert coupon code", 32 px tall, 1 px border, radius 4) taking all the width and the outline-primary button **APPLY** (about 46x32) at the right; APPLY posts `/api/coupons/redeem` and shows success or error text under the row in an `aria-live` region.
  Pack list: rows 60 px (92 px when it has a bonus and discount line), 15 px apart, `--bg-pack` (very light rose-ivory), radius 10, shadow `--sh-soft`, padding 15x20. Left: "**100**/Credits" (number 22 px bold, "/Credits" 12 px), a 10 px line "(290 + 10 FREE)" under it when a bonus exists. Right: price "Rs 1,000.00" bold 13 px; under it the original price struck through 10 px grey when discounted. Centre bottom: green pill "3% DISCOUNT" (10 px bold, `--ok-bg`/`--ok`, radius 4). Tags: "MOST POPULAR" (small plum pill with a heart icon at the top-left over the row) and "BEST DEAL" (green pill). Selecting a row highlights it with a 2 px plum border and a check; one row at a time. Footer of list, right aligned: "TOTAL: **Rs 0**" (12 px; plum amount) and the rose **PAY** button (230x40, faded until a pack is chosen). PAY calls `POST /api/wallet/packs` and handles `PAYMENT_REQUIRED`, `CONFLICT` and success honestly (test mode label "Test mode: no real payment" if the payment provider is mock). Then the help card and the footer.
- **Data** packs come from the CreditPack collection (same source `src/lib/credit-packs.ts` and the T4.1 seed: credits, price, bonus, tag, order). Never invent packs, prices, or discount percentages. Use `getCreditPacks()` (`src/lib/queries.ts`). Displayed credits = `credits + bonus`; the line "(credits + bonus FREE)" appears only when `bonus > 0`; the struck-through list price = (`credits + bonus`) x the base rate, where the base rate is `price / credits` of the pack with `bonus = 0` (the first pack); discount % = `round(100 x (1 - price / listPrice))`. If a pack has no bonus there is no struck price and no pill. Tags come from `pack.tag` ("Most popular", "Best deal").
- **Mobile**: rows full width, price below the credits line, TOTAL and PAY full width.

### P12 Coupons
- **Route** `/u/account/coupons/`. **REF** `09_vendor_coupons_desktop_1.png`.
- **Desktop**: H1 "Coupons" (32 px centred). "Do you have a Coupon?" with the ticket icon, the coupon row (full width input plus APPLY), 50 px gap, centred 16 px grey "Frequently asked questions", then two accordion rows (full width, 1 px hairlines, 14 px bold, a chevron at the right): "How to use a coupon?" and "Where do I see my coupons?" with short honest answers (use the coupon box on this page or on the Buy Credits page; coupon credit appears in the wallet history). Help card, footer.

### P13 Account settings
- **Route** `/u/account/edit-account/`. **REF** `10_vendor_settings_desktop_1.png`.
- **Desktop**: H1 "Account Settings" (32 px centred). "MY ACCOUNT" (12 px bold uppercase centred) with the user's email under it in 14 px. Card "CHANGE PASSWORD" (white, radius 10, shadow, padding 30, centred): a 14 px lock icon plus the caption "CHANGE PASSWORD" 18 px, an outline-rose button **CHANGE PASSWORD** (sends `POST /api/auth/forgot-password` with the user's email, then the text changes to "We have sent you an email"), and the line "We will send you an email to change your password" (13 px). Hairline. Card "Tharkoo News" (as in P09) with the rose link **Manage preferences** -> `/u/account/notifications/` (honest "Coming soon" if no API). Hairline. A tiny rose link "Delete my account" -> `/u/account/delete/` (confirmation page, honest if the API is missing). Help card, footer.

### P14 Post an ad: step 1 "Information"
- **Route** `/u/post-insert/` (`src/components/PostWizard.tsx`; signed-out visitors go to `/u/login/?next=/u/post-insert/`).
- **REF files** `11_post_ad_step1_desktop_1.png` to `_4.png`, `11_post_ad_step1_desktop_full.png`, `11_post_ad_step1_desktop_top_raw.png`, `11_post_ad_step1_validation_desktop.png`, `11_post_ad_step1_validation_after_dummy.png`.
- **Desktop**: header (no search icon). A 3-segment progress bar (each segment 4 px tall, 12 px gaps; the current and previous segments plum, the rest `--border`). Row: H1 "Information" (display 600, 32 px, left) and a pill "1/3" at the right (12 px bold, plum on `--tint`, radius 12, padding 2x8). Each group has a heading row ("Your Ad", "Your data", "About You", "Your contacts" at 16 px/600) with the right-aligned note "* Required fields" (10 px grey; 12 px minimum applies: use 12) and a bordered form panel (`--bg-form` very light ivory, 1 px `--border-2`, radius 10, padding 6x7, fields 12 px apart).
  Group "Your Ad": `* Select category` (select), `* Select city` (select, default current city), `* Select district` (select, disabled until a city is picked), then a two-column row `Address` and `Postal code` (inputs), then `Area/District/Neighbourhood` (full width input). Field labels 13 px bold with a red-rose star; inputs 36 px tall, white, 1 px `--border-2`, radius 4.
  Group "Your data": `* Age` (small 160 px input with a calendar icon in the label; shown when the chosen category has an age field), `* Nickname` with a rose pill "new" and the right note "max 20 characters" (placeholder "Insert your name or nickname"), `* Title` (textarea 2 rows, note "5 characters required", placeholder "Give your ad a good title"), `* Text` (textarea 5 rows, note "20 characters required", placeholder "Use this space to describe your ad, what you offer and what you like ...").
  Group "About You": rows built from the chosen category's own `fields` (D2): each field has an icon, a bold 13 px label, and chips (select/multiselect options as toggle chips: white, 1 px border, radius 16, 12 px; selected = rose fill/white) or a select when more than 8 options. If the category has no extra fields the group is hidden. (REF's body and service chip groups are not reproduced.)
  Group "Your contacts": label "How would you like to be contacted?" and three equal radio cards (**Only Phone**, **Only Email**, **Email and Phone**; selected card has a 1 px plum border and a plum filled radio, 40 px tall, radius 8); `* Phone Number` input with a flag + "+91" prefix select and the placeholder "+91 81234 56789" (Indian mobile validation as today); two switch toggles under it, "WhatsApp" (green icon) and "Telegram" (blue icon), each a 34x18 pill labelled NO/YES inside; when on, Telegram shows a handle field.
  Consent: two switches (36x18, NO/YES) with 11->12 px text: (1) "**Terms, Conditions and Privacy Policy** I have read the [Terms and Conditions] of use and [Privacy Policy] and I hereby authorise the processing of my personal data for the purpose of providing this web service." (required); (2) "I confirm that I am 18 or over, that the details in this ad are accurate, and that I own the rights to any photos I add." (required). (REF's second switch about special categories of personal data and the Cloudflare widget are not copied.)
  Bottom: **GO ON** (rose, 467x52, right aligned in the 960 column, 24 px above; REF text "GO ON"). Help card, footer.
- **Validation** (REF `11_*validation*`): on GO ON invalid controls get a 1 px red border (`--danger`) with a red (!) circle icon inside at the right, and a 12 px red message under the control; the page scrolls to the first error. Messages: "Please, fill in this field" (selects), "Invalid field" (age), "Name / Nickname is required", "You must enter at least 5 alphanumeric characters (a,b,c...z,0,1,2,3...)" (title), "You must enter at least 20 characters" (text), "If you want to be contacted by phone, please fill in this field" (phone), a red outline around the unchecked required switch. Server errors (`VERIFICATION_REQUIRED`, `FREE_LIMIT`, `POLICY_VIOLATION`, `RATE_LIMITED`) go in an `aria-live` banner above GO ON, written plainly.
- **Flow** GO ON creates or updates the draft (`POST /api/listings`, `PATCH /api/listings/{id}` stage `basics` then `details`), then moves to step 2 without a full page load; the URL becomes `/u/post-insert/?step=2&draft={id}`; Back keeps the data; leaving and returning resumes the draft.
- **Mobile**: fields full width and stacked (Address, Postal code stack), 44 px tall inputs, radio cards stack three high, GO ON full width.

### P15 Post an ad: step 2 "Photos" (not captured: standard pattern)
- Progress bar two segments filled, H1 "Photos", pill "2/3". Panel "Your photos": a dashed 2 px `--border` drop zone (radius 10, 160 px tall, ivory) with an upload icon, the line "Drag photos here or" and an outline-rose button **ADD PHOTOS**; note "Up to 6 photos, JPG, PNG or WebP, 8 MB each." Thumbnails (120x150, radius 8) with a 28 px round remove button and a "Cover" label on the first; drag to reorder is optional (use the media `reorder` endpoint if simple). Upload uses the existing media endpoints (`POST /api/media/sign`, direct upload, `POST /api/media/complete`); if the media endpoints cannot be completed safely, show the honest line "Photo upload is coming soon. You can add photos after publishing." and let the user continue. Buttons row: outline-rose **BACK** left, rose **GO ON** right.

### P16 Post an ad: step 3 "Publish" (not captured: standard pattern)
- Progress bar full, H1 "Publish", pill "3/3". Panel "Preview" shows the ad as a P04 card (free variant) and the ad detail summary pills. Panel "Plan": three plain rows (Free, Top, Super Top) showing only what the promotions API returns; if it returns nothing, a single honest row "Free: your ad is published once it passes our checks." with the rose link "Boost visibility" -> `/u/account/credits/`. Consent summary. Rose **PUBLISH** button (`POST /api/listings/{id}/submit`); on success a success panel "Your ad has been sent for review" with links "Your ads" and "Post another ad". `VERIFICATION_REQUIRED` shows "Verify your ID to publish" with a link to `/u/account/kyc/`.

### P17 Terms and static pages
- **Routes** `/terms/`, `/privacy/`, `/cookies/`, `/cms/[slug]/`, `/grievance/`, `/scam-report/`, `/submit-report/`, `/help/`, `/help/[slug]/`, `/blog/`, `/blog/[slug]/`, `/contact/`, `/about/` (redirect target kept `/cms/about/`).
- **REF files** `12_terms_desktop_1.png`, `_2`, `_3`.
- **Desktop**: header; then in the 960 column: heading "TERMS OF USE" uppercase 15 px weight 400 charcoal (tracking .02em; h1), "Last Updated – {month year}" 12 px, then body paragraphs 12 px/1.6 `--muted` (grey), bold lead-ins, bullet lists with 12 px text, sub-headings 12 px bold ("Paid Services: Offeror Users" style), links rose. Dense, narrow, no sidebar. `Prose` is restyled to this (max width 960, not 68ch). Content is Tharkoo's own text (existing pages), not REF's.
- **Help center** (REF capture missing): same column, H1 "Help Center" (display 32 px), a search-less list of article rows (14 px rose links, 1 px hairlines) grouped under 14 px bold group names; article page uses the Prose style.
- **Blog**: H1 "Tharkoo Blog"; list of rows (title rose 16 px bold, 13 px grey excerpt, 12 px date).

### P18 Login, register, recovery (not captured: simple matching pattern)
- **Routes** `/u/login/`, `/u/register/`, `/u/forgot/`, `/u/reset/`, `/u/verify-email/`, `/admin/login/`.
- Layout: header and footer as everywhere; centred card, 440 px wide, white, radius 12, shadow `--sh-card`, padding 32; H1 in the display font 600, 32 px centred ("Log in", "Create your account", "Forgot your password?", "Choose a new password", "Verify your email"); labels 13 px bold; inputs 44 px (16 px text on mobile), 1 px `--border-2`, radius 8, focus ring plum; primary button full width, rose, uppercase 14 px ("LOG IN", "CREATE ACCOUNT", "SEND LINK", "SAVE PASSWORD"); secondary text links in rose 14 px ("Forgot your password?", "Create an account", "I already have an account"); show/hide password; register keeps its real fields (name, email, password with strength bar, date of birth, terms checkbox, "I am 18 or over" checkbox). Errors in a 13 px red `aria-live` region. After login go to `?next=` or `/u/account/dashboard/`.

### P19 Account area pages without a REF capture
`/u/account/kyc/`, `/media/`, `/notifications/`, `/alerts/`, `/analytics/`, `/subscription/`, `/packs/`, `/saved/`, `/credits/bank/`, `/credits/history/`, `/delete/`, `/ads/in00001/` use the vendor page pattern (H1 32 px display centred, 960 column, white cards, help card, footer). Screens without an API keep the honest "Coming soon" EmptyState restyled in light tokens (no fake data).

### P20 System pages
`not-found`, `error`, `global-error`, `429`, `gone`, `maintenance`: centred EmptyState in the 960 column inside the normal header and footer, light tokens, a rose button "Back to home".

### P21 Admin
`/admin/**` keeps its structure and logic. Only tokens change: light surfaces, plum primary, rose accent, Manrope; sidebar white with a plum active row; no dark sidebar.

## 3. Content mapping (policy-safe)

### 3.1 Categories (existing seed, `src/server/seed/data.ts`)
Slugs: dating, friendship, meetups, personal-ads, jobs, wellness, property, vehicles, buy-and-sell, pets, education. Do not add, rename or reorder categories.
| REF slot | Tharkoo category | Card icon (lucide) | Neutral home-card text (fallback when `homeBlurb` empty) | Placeholder photo |
|---|---|---|---|---|
| Home card 1 | Dating (`dating`) | Heart | "Meet people near you. Clear profiles, honest details, and manual ID checks." | `/placeholders/dating/01.webp` |
| Home card 2 | Wellness (`wellness`) | Leaf | "Spa, yoga, fitness and therapeutic massage bookings from verified providers." | `/placeholders/wellness/01.webp` |
| Home card 3 | Friendship (`friendship`) | Users | "Make friends and find company for coffee, trips and hobbies." | `/placeholders/friendship/01.webp` |
| Home card 4 | Meetups (`meetups`) | CalendarDays | "Join local meetups, classes and group activities in your city." | `/placeholders/meetups/01.webp` |
| Home card 5 | Personal ads (`personal-ads`) | MessageSquareHeart | "Short personal notices for dating, friendship and activities." | `/placeholders/personal-ads/01.webp` |
| REF "city group" cards 1 to 5 | the same five, same order | same | n/a | n/a |
| extra group card | "More categories": Jobs, Property, Vehicles, Buy and sell, Pets, Education as pills | n/a | n/a | n/a |
Page titles and H1s use the category name as is ("Dating Bengaluru (Karnataka)"). No page may use REF's category words or their synonyms.
The reference card text, tagline strings and ad copy of REF are never copied; the neutral strings in this spec are the only copy that may be shipped.

### 3.2 Text swaps (everything else keeps the REF wording)
| REF text | Tharkoo text |
|---|---|
| hero tagline "...{brand} is for everyone" | "Single? Taken? Doesn't matter, Tharkoo is for everyone" |
| home subtitle "Find your favourite ..." | "Find your favourite listings on Tharkoo" |
| age-gate title and body | section 1.7 |
| footer about | section 1.3 |
| "RESTRICTED TO ADULTS" badge | "18+ ONLY" |
| footer Company links | "About Tharkoo", "Contact us" |
| "{Brand} News" | "Tharkoo News" |
| "Services" (ad section) | category-neutral label from the field group (Dating, Friendship, Meetups, Personal ads: "Interests"; Wellness: "Services"; Jobs: "Role"; Property: "Details"; Vehicles: "Details"; Buy and sell: "Details"; Pets: "Details"; Education: "Subjects"). The icon stays a heart/list |
| "Attention to" | shown only for dating, friendship, meetups, personal-ads; values from the category field `looking-for` or chips: Everyone, Men, Women, Couples |
| "Place of service" | label "Where" for all but the four personal categories; values from existing tags such as Cafe, Events, Outdoors, Online; the four personal categories use the label "Where we can meet" |
| search filters, post chips | category `fields` (section P08, P14) |

### 3.3 Listing card meta
`age` shown when the doc has it. Otherwise the first line shows the category name. The second line is "City/ Area" from `place`.

## 4. THEME: premium light (replaces Midnight and Champagne)

Name: **Plum and Rose on Ivory**. Light only (`color-scheme: light`). Implementation: rewrite `src/styles/tokens.css` with the tokens below, rename the old semantic tokens (`--gold*` to `--accent*`, `--ink` to `--on-primary`) and remap `@theme inline` so utilities read `bg-bg`, `bg-card`, `text-text`, `text-muted`, `text-primary`, `text-accent`, `border-line`, `font-display`, `font-sans`. After the change `rg -i "gold|champagne|midnight|#0b0b0e" src docs` must return nothing outside this spec.

### 4.1 Tokens
```
:root{
  color-scheme: light;
  /* surfaces */
  --bg:#FFFDFB;            /* page: warm white, ivory */
  --bg-soft:#FAF6F1;       /* section wash, form panels */
  --card:#FFFFFF;          /* cards, modals, drawer */
  --tint:#F7EEF3;         /* light plum wash (selected rows, pills) */
  --tint-rose:#FAEFF2;     /* highlight cards, selected chips */
  --chip:#EFE7DF;          /* grey-beige chips, badges, grey buttons, modal head */
  --bar:#F1E4E8;           /* footer bottom bar (blush) */
  --letterbox:#F3EDE6;     /* gallery frame behind images */
  --bg-pack:#FBF5F7;       /* credit pack rows */
  --bg-form:#FCF9F5;       /* form panels */
  /* lines */
  --border:#EAE3DC;  --border-2:#E2DAD2;  --border-strong:#D6CCC2;
  /* text */
  --text:#1F2433;          /* navy-charcoal: headings, titles, body strong */
  --body:#4A4F5E;          /* running text */
  --muted:#6E7180;         /* captions, footer links (4.8:1 on white) */
  /* brand */
  --primary:#6A2150;  --primary-hover:#561A41;  --primary-press:#451433;  --on-primary:#FFFFFF;
  --accent:#A63A5E;   --accent-hover:#8A2F4F;   --accent-press:#732643;  --on-accent:#FFFFFF;
  --gold-rose:#C9967E;     /* decoration only: icons, tab labels (rename token --rose-gold) */
  --rose-gold-soft:#E9C27A; /* "SECURITY TIPS" tab, star icon */
  --wa:#0F8247;  --wa-hover:#0B6B3A;           /* WhatsApp green kept */
  --tg:#167CAB;                                  /* Telegram */
  --ok:#1C7A45;  --ok-bg:#E3F4EA;               /* discount, success */
  --warn:#9A5B00; --warn-bg:#FFF1D6;
  --danger:#C0352F; --danger-bg:#FDECEA;
  --focus:#6A2150;         /* 2 px ring, offset 2 */
  /* gradients */
  --grad-hero:linear-gradient(100deg,#5A2158 0%,#7B2D5E 38%,#B8486B 72%,#E0A08A 100%);
  --grad-promo:linear-gradient(100deg,#6A2150 0%,#A63A5E 100%);
  /* radii */
  --r-xs:4px; --r-sm:6px; --r-md:8px; --r-lg:10px; --r-xl:12px; --r-pill:16px; --r-search:31px;
  /* shadows */
  --sh-card:0 2px 20px rgba(106,33,80,.12);
  --sh-soft:0 2px 12px rgba(106,33,80,.08);
  --sh-pop:0 8px 32px rgba(31,36,51,.18);
  /* motion */
  --ease:cubic-bezier(.2,.8,.2,1); --t-fast:150ms; --t-base:250ms; --t-slow:400ms;
  --header-h:76px;
}
```
Contrast checks (computed): rose `#A63A5E` on white 6.2:1 and on `--bg` 6.1:1; white on plum 10.8:1; white on rose 6.2:1; white on `--wa` 4.9:1; `--muted` on white 4.8:1; plum on `--tint` 9.5:1; rose on `--tint-rose` 5.5:1; green `--ok` on `--ok-bg` 4.7:1. No text colour may be lighter than `--muted` (REF's 3.9:1 light greys are not copied).

### 4.2 Fonts (via `next/font/google`, `src/styles/fonts.ts`, no change of families)
- Display: **Cormorant Garamond** 600/700 (`--font-display`). Used for: the wordmark, hero tagline, page titles (H1 on vendor, form and static pages), section H2 ("Hot meetings in your city"), card overlay titles, "Contact me", credits headings. Never below 24 px.
- Body/UI: **Manrope** 400/500/600/700/800 (`--font-sans`) for everything else (REF is a clean sans, Manrope matches its feel). Card titles use weight 800 at 18 px.
- Scale (px, desktop/mobile): wordmark 28; hero 48/20; H2 30/24; page H1 32/28 (vendor, forms), listing H1 16/16 (REF small text), card title 18/18, body 14/16, meta 12/12, labels 13 bold, buttons 14 uppercase weight 500 (600 in Manrope), caption 12 (nothing under 12 px). Numbers `tabular-nums`.
- Inputs and buttons use 16 px on mobile.

### 4.3 One-to-one colour map (REF to Tharkoo)
| REF colour and use | Tharkoo token and value |
|---|---|
| magenta `#BE206B`: links, listing titles, nickname, phone button, SEARCH, GO ON, ACCEPT, BUY CREDITS, PAY, pill borders, chevrons | `--accent` `#A63A5E` |
| magenta hover `#9F1959` | `--accent-hover` `#8A2F4F` |
| blue `#448BC6`: POST YOUR AD, security-tips panel, super-top border and badge, active tab underline, progress bar, APPLY, step 1/3 pill | `--primary` `#6A2150` |
| blue hover `#3571A3` | `--primary-hover` `#561A41` |
| light blue wash `#F2F9FF` (filter chip bg), pale blue pill | `--tint` `#F7EEF3` |
| pink wash `#F5CEE0` (selected chip), `#F9EAF1` (highlight card) | `--tint-rose` `#FAEFF2` (selected chip border `--accent`) |
| page white `#FFFFFF` | `--bg` `#FFFDFB` (cards stay `#FFFFFF`) |
| text `#2E2E2E`, `#1F1F1F`, navy `#1C1C1C` | `--text` `#1F2433` |
| body grey `#484848`, `#555555`, `#5A5A5A` | `--body` `#4A4F5E` |
| footer and meta grey `#71727A`, `#888`, `#666`, `#6C757D` | `--muted` `#6E7180` |
| border `#E8E8E8`, `#EEE`, `#F2F2F2` | `--border` `#EAE3DC` / `--border-2` `#E2DAD2` |
| input border `#CCC`, `#DDD` | `--border-strong` `#D6CCC2` |
| chip grey `#D9D9D9`, modal head `#F7F7F7`, grey buttons `#DDD` | `--chip` `#EFE7DF` |
| dark footer bar `#323232` | `--bar` `#F1E4E8` (text and icons `--primary`) |
| dark gallery letterbox `#10172A` and its pill `#0C0E18` | `--letterbox` `#F3EDE6` and a white pill |
| hero gradient navy to magenta (`#163A7A`, `#4A2A78`, `#C02070`) | `--grad-hero` (plum, rose-plum, rose, warm rose) |
| city directory banner flat magenta | `--primary` flat |
| WhatsApp green `#25D366` (kept) | `--wa` `#0F8247` |
| Telegram `#0088CC` | `--tg` `#167CAB` |
| Top and super-top orange/blue badge colours | plum `--primary` text; "Available now" `--ok` |
| security-tips yellow tab `#F5B800` | `--rose-gold-soft` `#E9C27A` with plum text |
| discount pill green `#DFF7E7` / `#1B9B4A` | `--ok-bg` / `--ok` |
| validation red `#E0344C` | `--danger` `#C0352F` |
| pack row lavender `#F7F8FF` | `--bg-pack` `#FBF5F7` |
| card shadow `#6B86B126` | `--sh-card` |

### 4.4 Radii, shadows, spacing
Radii: header buttons 8; hero search 31; cards 8 to 10 (listing 8, home/vendor 10); pills 16; inputs 4 to 8 (forms 4, login 8); modals 12; chips 5 to 8. Shadows only the three tokens. Spacing in the REF rhythm: 15 px gutters, 20 px between listing cards, 30 px grid gaps, 48 px section gaps, 24 px page bottom padding.

### 4.5 Logo
`public/brand/logo-mark.svg` and `public/logo.svg`: new two-arch mark (two overlapping rounded arches, one plum `#6A2150`, one rose `#A63A5E`, 28 px) plus the wordmark text rendered by CSS, not an image. Favicon uses the mark on white. OG image `public/brand/og-default.png`: ivory background, plum wordmark, rose tagline (regenerate with `scripts/make-og.mjs`).

## 5. Navigation flow (REF behaviour, Tharkoo routes)
1. First visit: age gate over `/` -> ACCEPT stores the choice -> home.
2. Home -> hero pill or header search icon -> search modal -> `/search/` or `/{category}/{city}/`.
3. Home -> category card or city row -> `/{category}/{city}/` -> card -> `/ad/{slug}/` -> Call/WhatsApp reveal -> report -> `/submit-report/`.
4. Header POST YOUR AD (or drawer, footer, home mobile button) -> `/u/post-insert/` (login redirect when signed out) -> step 1 Information -> step 2 Photos -> step 3 Publish -> `/u/account/ads/`.
5. Account icon -> dropdown -> Dashboard -> tiles Ads / Wallet (BUY CREDITS) / Coupons / Settings -> back via header.
6. Footer links: Terms -> `/terms/`; Privacy -> `/privacy/`; Cookie -> `/cookies/`; Help Center -> `/help/`; Submit a Report -> `/submit-report/`; Blog -> `/blog/`; How to report a scam -> `/scam-report/`; About -> `/cms/about/`; Contact -> `/contact/`; Countries select -> stays (India).

## 6. Gaps in the capture (what the coder must infer)
- Post-ad steps 2 and 3, login, register, forgot, help center, blog, 404 and cookie banner were not captured: specified here as standard patterns (P15, P16, P18, P17, P20, 1.7).
- Hover and pressed states were not recorded for most controls: use the rules in 1.5.
- The state-hub page (`/[category]/`), the photo card on mobile, and the district dropdown contents are assumptions (P03, P04).
- REF's captured ad photo galleries and some masked values (phone number, name, email) are blurred in the capture; the layout is clear, the values are not needed.
- REF mobile ad pages show a dark letterbox that we replace (D8).

## 7. Acceptance checklist (the auditor compares side by side at 1440x900 and 390x844, REF capture vs Tharkoo screenshot)
Global
- [ ] `color-scheme: light`; computed `body` background luminance above 0.9 on every route; no element with a background darker than `#5A2158` except the hero gradient start; no black or dark footer, gallery or admin sidebar.
- [ ] Fonts: headings and the wordmark in Cormorant Garamond, everything else Manrope; nothing under 12 px; `rg -i "gold|champagne|midnight"` is empty.
- [ ] Container is 960 px at 1440; hero text uses the wider container; gutters 15 px.
- [ ] Header is not sticky; logo plus "India" subline; city subline on city, category and ad pages; icons per 1.1; POST YOUR AD plum, 8 px radius, uppercase.
- [ ] Drawer (390): 277 px, slides from the right, dims the page, has "Publish ad", POST YOUR AD, "Services for you!", Blog, Help Center; focus trap and Esc work.
- [ ] Footer: brand row with "18+ ONLY", four columns (Legal, Support, Security, Company), "Boost your visibility" plus button, "Countries" select with India, legal line, blush bottom bar with copyright and Back to top pill.
- [ ] Age gate: blurred page, white 500 px card, 18+ icon, title, body, ACCEPT, Decline; fades in.
Home
- [ ] Hero 70vh at 1072 px height (290 px at 390), gradient plus neutral placeholder, tagline with the Tharkoo name, search pill 62 px tall (64 mobile) with placeholder "Search By City, Category..." that opens the search modal.
- [ ] H2 "Hot meetings in your city" plus subtitle; five photo cards in a 3-column grid (2, 1 on smaller screens) with overlay title and icon, description, three bordered city rows; image zoom on hover.
- [ ] SEO paragraph, five city-group cards plus "More categories" with pills, footer.
- [ ] Mobile: POST YOUR AD button under the hero.
City listing and category plus city
- [ ] Location field with pin and round rose search button; up to four filter chips; hairline; breadcrumb with trailing caret; small H1; single centred column of cards.
- [ ] Card variants: free (text only), top (photo, "Top"), super top (photo, arrows, 2 px plum border, "SUPER Top", two circle contact buttons), highlight (tint). Titles rose, 18 px, 800; meta rows with age and "City/ Area"; "📷 N" chip.
- [ ] House promote band every 6 cards; "Show more" link; no phone numbers in HTML.
Ad detail
- [ ] Back to search, 5-level breadcrumb, date and Ad ID line, summary card (nickname, badge, two pills, title, Call and WhatsApp buttons), gallery mosaic on light letterbox, About me, chips, section headings with icons, "Contact me" with the two buttons, Share ad, Report abuse or fraud, "All ads in ... ›", plum Security tips panel with the gold tab, disclaimers.
- [ ] Mobile: SHOW ALL pill, gallery frame 390x395, fixed bottom Call plus WhatsApp bar, 80 px bottom padding; gallery modal with Back.
Search modal
- [ ] 800 px modal (full screen at 390): head "Search"; category select plus "Search here..."; "Select Region", "All the cities", "Select District" (disabled until city); "Filters" rows with rose chevrons that expand; footer DELETE ALL and SEARCH.
Vendor
- [ ] Dashboard grid (Ads, Wallet with BUY CREDITS, Coupons, Settings, News, Security tips, profile card, Star card), help card; all numbers real or "–".
- [ ] Your Ads (tabs with counts, "You have N ... ads"), Buy Credits (balance card, coupon row, pack rows with discount pills and MOST POPULAR / BEST DEAL, TOTAL and PAY), Coupons (APPLY, two FAQ rows), Account Settings (MY ACCOUNT, CHANGE PASSWORD, Tharkoo News, Delete my account).
Post an ad
- [ ] Three-segment progress bar and "Information 1/3"; groups Your Ad, Your data, About You (from category fields), Your contacts; radio cards, phone with +91, WhatsApp and Telegram switches, two consent switches, GO ON; red validation messages as listed; steps 2 and 3 exist and work; draft resumes.
Static and auth
- [ ] Terms-style dense narrow column with an uppercase small H1; login, register, forgot and reset use the centred card pattern; 404, 429 and error pages use the light EmptyState.
Content policy and quality
- [ ] No sexual, explicit or paid-companionship wording; no REF photos, names, copy or logos anywhere; placeholders only; forbidden-terms CI passes.
- [ ] One `<h1>` per page, unique titles, canonical tags present; no 4xx or 5xx and no console errors on every route at 390 and 1440; no horizontal scroll at 390.
- [ ] All 7 CI checks green; PR open and not merged.
