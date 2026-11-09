# Agent notes (Tharkoo)

- Spec: `docs/prd/PRD.txt` (and the .docx). Plan: `docs/PLAN.md`. Continue: `docs/HANDOFF.md`.
- Karpathy: smallest change that meets the current slice. No drive-by refactors.
- Stack: Next.js App Router, Mongoose, Vercel (app URL), DigitalOcean (Mongo).
- Public URLs are PRD §4. Dynamic catalogue in Mongo — never hard-code category names in components.
- Seed: `src/data/` + `npm run seed`.
- Dev server port **4317**.
- Do not scrape or paste competitor listings/photos.
- Continue from `PROGRESS.md`, `docs/WORKFLOW.md`, and `docs/contracts/` (contracts arrive in T1.1). Plan: `docs/MASTER_PLAN.md`. Code reality: `docs/CODE_MAP.md`.
- Karpathy (https://github.com/multica-ai/andrej-karpathy-skills): state assumptions before coding; smallest change that meets the task; touch only owned paths; define a check you can run. Full text: `.cursor/rules/karpathy-guidelines.mdc`.
- Graphify first: `graphify query "<question>"` (or `path` / `explain`) before reading the tree. `graphify update .` after code changes. Do not commit `graphify-out/`.
- Skills live in `.agents/skills/`. Read `.agents/README.md` for which ones matter. Read the skill the brief names before writing SEO or marketing copy.
- Content policy: no escort, sexual-service, or companionship-for-pay categories, copy, or products, and no competitor brand assets or listing text. The forbidden-terms CI check enforces this. Do not add those strings in tests or fixtures.
- Dependencies only in T0.3. Other tasks do not add npm packages unless their brief lists the package.
