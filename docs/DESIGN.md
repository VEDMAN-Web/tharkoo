# Tharkoo design system

Midnight and champagne. Near-black surfaces, ivory text, one champagne-gold accent. Dark is the only theme.

## Tokens

Defined in `src/styles/tokens.css` and mapped in `src/app/globals.css` for Tailwind (`bg-surface`, `text-gold`, `text-muted`, `border-line`, `font-display`).

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0B0B0E` | Page |
| `--surface` | `#16161C` | Cards |
| `--text` | `#F4F1EA` | Primary text |
| `--text-muted` | `#A8A399` | Secondary text |
| `--gold` | `#C9A96E` | Accent, links, primary buttons |
| `--ink` | `#0B0B0E` | Text on gold |
| `--focus` | `#E8D3A6` | 2px focus ring, 2px offset |

Radii: 6 / 10 / 16 / 24 / pill. Cards use 16. Buttons use 10. Dialogs use 24.

Type: Cormorant Garamond for display, H1, H2, prices, and the wordmark (never under 24px). Manrope for everything else. Minimum text size is 12px. One H1 per page.

## Components

Live samples: `/styleguide/`.

| Component | Notes |
|---|---|
| `Button` | `primary` `secondary` `ghost` `outline` `danger`; sizes `sm` `md` `lg`; `loading`; renders a link when `href` is set |
| `Input` / `Field` | Label above, 16px text, 48px height |
| `Chip` | Real link when `href` is set |
| `Badge` | `new` `highlight` `top` `supertop` `star` `verified` `live` |
| `AdCard` | One stretched link. Variants follow `ad.variant` |
| `Gallery` | Placeholder when there are no photos |
| `EmptyState` | Always include a next action |
| `Dialog` | Focus trap, Esc, scroll lock |
| `SmartImage` | Falls back to `PlaceholderArt` when the source is empty or fails |

## Do

- Use tokens and the type classes (`.t-display` through `.t-overline`).
- Keep contact numbers off the page until a reveal click.
- Use `displayTitle()` so a numeric prefix is never shown.
- Give every empty state a real next step.
- Add `prefetch={false}` on link grids of more than 12 links.

## Do not

- Do not introduce a light theme, a third font, or text under 12px.
- Do not invent balances, counts, coupons, or success states.
- Do not print phone, WhatsApp, or Telegram values in the initial HTML.
- Do not copy another classifieds site’s colours, layout, or wording.
- Do not add sexual or companionship-for-pay copy.
