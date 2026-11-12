#!/usr/bin/env node
// Thin shim: the check now lives in scripts/seo-check.ts (rules in src/server/seo/).
// Kept so `node scripts/seo-check.mjs` and `npm run seo:check` both still work.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./seo-check.ts", import.meta.url));
const run = spawnSync(process.execPath, ["--import", "tsx", script], { stdio: "inherit", env: process.env });
process.exit(run.status ?? 1);
