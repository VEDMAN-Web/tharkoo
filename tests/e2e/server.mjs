#!/usr/bin/env node
// Starts the PRODUCTION build against an in-memory MongoDB, seeded with demo data.
// Used by the e2e suite (playwright.config.ts webServer) and runnable by hand:
//   npm run build && node tests/e2e/server.mjs
// Local-only values. Never point this at a real database.
// Writes the in-memory Mongo URI to E2E_MONGO_URI_FILE so tests can promote roles.

import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = process.env.E2E_PORT || "4342";
const uriFile = resolve(process.env.E2E_MONGO_URI_FILE || ".shots/e2e/mongo-uri.txt");

const mongod = await MongoMemoryServer.create({ instance: { dbName: "tharkoo" } });
const uri = mongod.getUri("tharkoo");
mkdirSync(dirname(uriFile), { recursive: true });
writeFileSync(uriFile, uri);

const env = {
  ...process.env,
  MONGODB_URI: uri,
  SITE_URL: `http://127.0.0.1:${PORT}`,
  NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${PORT}`,
  SITE_NOINDEX: "true",
  STAGING_AUTO_VERIFY_EMAIL: "true",
  COOKIE_SECURE: "false",
  SITE_RATE_MAX: process.env.SITE_RATE_MAX || "100000",
  SEARCH_RATE_MAX: process.env.SEARCH_RATE_MAX || "100000",
  SESSION_SECRET: "local-only-session-secret-not-real-0001",
  CONTACT_ENCRYPTION_KEY: "local-only-0123456789abcdef012345",
  // Lets the tests confirm a mock payment through the signed webhook, like the provider would.
  PAYMENT_WEBHOOK_SECRET: "e2e-webhook-secret-not-real",
  ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL || "homepage-admin@example.test",
  ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD || "HomepageAdmin1!",
  NODE_ENV: "production",
};

function run(cmd, args) {
  return new Promise((res, rej) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: process.platform === "win32", env });
    child.on("exit", (code) => (code === 0 ? res() : rej(new Error(`${cmd} ${args.join(" ")} exited ${code}`))));
  });
}

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await mongod.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

console.log("[e2e-server] seeding in-memory MongoDB");
await run("npx", ["tsx", "scripts/seed.ts"]);
// The data cache on disk holds ids from a previous in-memory database; drop it.
rmSync(".next/cache", { recursive: true, force: true });
console.log(`[e2e-server] starting http://127.0.0.1:${PORT}`);
await run("npx", ["next", "start", "-p", PORT, "-H", "127.0.0.1"]);
await stop();
