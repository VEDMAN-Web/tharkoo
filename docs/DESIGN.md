# Tharkoo design system

Plum and rose on ivory. Light is the only theme. `color-scheme: light`.

## Tokens

Defined in `src/styles/tokens.css` and mapped in `src/app/globals.css`.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#FFFDFB` | Page |
| `--card` | `#FFFFFF` | Cards and dialogs |
| `--text` | `#1F2433` | Primary text |
| `--muted` | `#6E7180` | Secondary text |
| `--primary` | `#6A2150` | Plum actions and wordmark |
| `--accent` | `#A63A5E` | Rose links and filled buttons |
| `--focus` | `#6A2150` | 2px focus ring, 2px offset |

The only mid-dark colour is the hero gradient start `#5A2158`. Page surfaces stay light.

Type: Cormorant Garamond for display headings and the wordmark. Manrope for body, UI, and listing titles. Minimum text size is 12px. One H1 per page. Content width is 960px.

## Components

Live samples: `/styleguide/`. New layout classes use the `tk-` prefix.

| Component | Notes |
|---|---|
| `Button` | `primary` `secondary` `ghost` `outline` `danger`; renders a link when `href` is set |
| `Input` / `Field` | Label above, error text under the control |
| `Chip` | Real link when `href` is set |
| `AdCard` | Variants `free` `top` `supertop` `highlight` `star` |
| `Gallery` | Light letterbox, show-all sheet |
| `EmptyState` | Always include a next action |
| `Dialog` | Focus trap, Esc, scroll lock, white panel |
| `SmartImage` | Falls back to `PlaceholderArt` when the source is empty or fails |

## Do

- Use tokens and the type classes.
- Keep contact numbers off the page until a reveal click.
- Use `displayTitle()` so a numeric prefix is never shown.
- Give every empty state a real next step.
- Add `prefetch={false}` on link grids of more than 12 links.

## Do not

- Do not introduce a dark theme, a third font, or text under 12px.
- Do not invent balances, counts, coupons, or success states.
- Do not print phone, WhatsApp, or Telegram values in the initial HTML.
- Do not add sexual or companionship-for-pay copy.
