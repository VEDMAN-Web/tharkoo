#!/usr/bin/env node
// Run the PRODUCTION build locally against an in-memory MongoDB, seeded, so SEO and
// UI checks see what real visitors and crawlers will see.
//
//   node scripts/local-prod.mjs           # seed + build + start on http://127.0.0.1:4317
//   node scripts/local-prod.mjs --no-build  # reuse the last .next build
//
// Leave it running in its own terminal. Ctrl+C stops the site and the database.
// Uses only fake local values. Never point this at a real database.

import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = "4317";
const skipBuild = process.argv.includes("--no-build");

const mongod = await MongoMemoryServer.create({ instance: { dbName: "tharkoo" } });
const env = {
  ...process.env,
  MONGODB_URI: mongod.getUri("tharkoo"),
  SITE_URL: `http://127.0.0.1:${PORT}`,
  NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${PORT}`,
  SITE_NOINDEX: "false",
  // High limits so crawls are not throttled. Override to test the limiter, e.g. SITE_RATE_MAX=240.
  SITE_RATE_MAX: process.env.SITE_RATE_MAX || "100000",
  SEARCH_RATE_MAX: process.env.SEARCH_RATE_MAX || "100000",
  SESSION_SECRET: "local-only-session-secret-not-real-0001",
  CONTACT_ENCRYPTION_KEY: "local-only-0123456789abcdef012345",
  // Local-only test admin, same throwaway values scripts/ui-smoke.mjs already uses.
  ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL || "homepage-admin@example.test",
  ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD || "HomepageAdmin1!",
  NODE_ENV: "production",
};

function run(cmd, args, extra = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: process.platform === "win32", env: { ...env, ...extra } });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`))));
  });
}

const stop = async () => {
  await mongod.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

console.log("[local-prod] seeding in-memory MongoDB");
await run("npx", ["tsx", "scripts/seed.ts"]);
if (!skipBuild) {
  console.log("[local-prod] building (takes a few minutes)");
  await run("npx", ["next", "build"], { NODE_OPTIONS: "--max-old-space-size=4096" });
}
// The data cache on disk holds ids from the previous in-memory database; drop it so
// counts and sitemaps match this fresh seed.
rmSync(".next/cache", { recursive: true, force: true });
console.log(`[local-prod] starting http://127.0.0.1:${PORT}`);
await run("npx", ["next", "start", "-p", PORT, "-H", "127.0.0.1"]);
await stop();
