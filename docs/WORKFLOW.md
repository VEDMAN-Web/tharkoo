# Git workflow

From `docs/MASTER_PLAN.md` section 3:

- `main` is always deployable. Branch per task: `cursor/<task-id>-<slug>` or `codex/<task-id>-<slug>`. Codex: rename local `codex/phase-0-stabilization` to `codex/t0.2-lint-types` after `git fetch origin && git rebase origin/main`; never push other local-only history.
- Start of task: `git fetch origin && git switch -c <branch> origin/main`, `graphify update .`, read `PROGRESS.md` + `progress/*.md` of dependencies.
- During: small commits quoting the task id (`T2.1: ...`). PR <= ~400 changed lines excluding lockfile/tests; split otherwise.
- Before PR: `git fetch && git rebase origin/main`, `npm run lint && npm run typecheck && npm test && npm run build` green locally, write `progress/<task-id>.md` (done / not done / API or schema changes / how verified / next).
- Deps rule: all planned packages are installed once in T0.3 (zod, bcryptjs, cloudinary, @getbrevo/brevo or fetch, vitest, @playwright/test, mongodb-memory-server, pino, @axe-core/playwright, gitleaks via CI). Later tasks may append a package only if listed in their brief; after any rebase conflict in package-lock.json: take main's lockfile and run `npm install` (never hand-merge).
- CI (T0.1, required checks): lint, typecheck, test, build (with MONGODB_URI unset), gitleaks, ownership-check (diff paths subset of the task's paths in docs/ownership.json), forbidden-terms check (policy deny-list grep on src/ + seed).
- Merge: only Ana, squash-merge after audit (CI green + diff within ownership + acceptance list re-run + one S-tier review on S tasks). Agents never merge, never force-push main, never push to another agent's branch. Merge order follows dependencies below; after each merge Ana updates `PROGRESS.md` (index) and notifies the other platform's next task.
- Shared files with single owners: package.json/package-lock.json (T0.3, append-only after), next.config.ts (T0.3), src/app/globals.css + src/styles (T8.1), src/lib/db.ts (T0.3), `docs/contracts/**` (T1.1; changes via PR to that owner), `PROGRESS.md` (Ana only), `progress/<task-id>.md` (that task only).
- Handoff between platforms = files in repo only: `PROGRESS.md` (index: task, status, branch, PR, owner, blockers), `progress/*.md`, `docs/contracts/*`, `docs/HANDOFF.md` (points to these). No chat-only knowledge.
- Release: tag `v0.N` on main after each phase gate; deploy = tag push (section 8).

Relay mode: one coder at a time; before starting, git pull main and read PROGRESS.md; before stopping (done or out of usage), push your branch and update progress/<task>.md with exact next steps.
