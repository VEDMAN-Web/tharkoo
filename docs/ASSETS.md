# Assets

Every file under `public/` after T0.4, with licence or origin. `public/brand/` is empty and owned by T8.1; this task did not add files there.

| Path | What it is | Licence / origin |
|---|---|---|
| `public/logo.svg` | T monogram on a rounded square. Not wired into `src/components/Logo.tsx` (that file is outside T0.4). | Original, drawn for Tharkoo on 2026-11-10. Project may use it without attribution. |
| `public/placeholders/p1.jpg` … `p8.jpg` | Flat colour cards used on home category blocks and demo listing photos. | Original, generated for Tharkoo on 2026-11-10 with ffmpeg `color` + `drawbox`. No third-party photograph. Replaces earlier portrait JPGs whose licence was not recorded. |
| `public/placeholders/p1.svg` … `p8.svg` | Simple geometric figure, clothed, one colourway each. | Already in the repo before T0.4. Hand-written SVG, no third-party mark or photo. Treated as project-original placeholder art. |
| `public/placeholders/empty.svg` | Grey empty-state figure. | Same as the geometric SVGs: in-repo, hand-written, project-original. |
| `public/placeholders/restricted.svg` | Dark frame with a small lock shape. | Same as the geometric SVGs: in-repo, hand-written, project-original. |
| `public/file.svg` | Document icon. | Next.js `create-next-app` default. MIT, copyright Vercel, Inc. and Next.js contributors. |
| `public/globe.svg` | Globe icon. | Next.js `create-next-app` default. MIT, Vercel / Next.js contributors. |
| `public/next.svg` | Next.js wordmark. | Next.js `create-next-app` default. Next.js trademark, MIT project. Not a Tharkoo brand asset. |
| `public/vercel.svg` | Vercel triangle. | Next.js `create-next-app` default. Vercel trademark. Not a Tharkoo brand asset. |
| `public/window.svg` | Window icon. | Next.js `create-next-app` default. MIT, Vercel / Next.js contributors. |

Removed in T0.4:

- `public/reference-site/*.jpg` (five files). Copied listing chrome. Deleted, not relicensed.
- `scripts/patch-reference-site-copy.ts`. Deleted with that script's copy.

`src/components/Logo.tsx` still draws its own inline mark. That component is not on the T0.4 allow-list, so this task did not replace it. Use `public/logo.svg` when that component is next edited.
