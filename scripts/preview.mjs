#!/usr/bin/env node
// Online preview of the CURRENT checkout for Vedant (phone or any browser), from this PC.
//
//   node scripts/preview.mjs   # build + start + public link (always rebuilds: the link changes every start
//                              # and pages are built with it, so canonicals/noindex are right)
//
// What it does: starts a free Cloudflare "quick tunnel" (no account, random https://<words>.trycloudflare.com
// link), an in-memory MongoDB with the demo seed, and the production build behind that link.
// The link works only while this command runs and this PC is awake; it changes on every start.
// Safety: SITE_NOINDEX=true (search engines told to stay out), demo data only, and a fresh random
// admin password per run. Link + admin login are written to .relay/preview.txt (git-ignored, local only).
// Never print the password in chat. Needs `cloudflared` on PATH (Windows: winget install --id Cloudflare.cloudflared -e).

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = "4317";
const win = process.platform === "win32";
const children = [];

function start(cmd, args, env, opts = {}) {
  const child = spawn(cmd, args, { stdio: opts.pipe ? ["ignore", "pipe", "pipe"] : "inherit", shell: win, env });
  children.push(child);
  return child;
}
function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = start(cmd, args, env);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`))));
  });
}

function openTunnel() {
  return new Promise((resolve, reject) => {
    const t = start("cloudflared", ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${PORT}`], process.env, { pipe: true });
    const timer = setTimeout(() => reject(new Error("cloudflared did not print a link within 60 s")), 60_000);
    const scan = (buf) => {
      const m = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m) {
        clearTimeout(timer);
        resolve(m[0]);
      }
    };
    t.stdout.on("data", scan);
    t.stderr.on("data", scan);
    t.on("error", (e) => reject(new Error(`cloudflared not found or failed: ${e.message}`)));
    t.on("exit", (code) => reject(new Error(`cloudflared exited ${code}`)));
  });
}

let mongod;
const stop = async () => {
  for (const c of children) {
    try { c.kill(); } catch { /* already gone */ }
  }
  if (mongod) await mongod.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

const url = await openTunnel();
const adminEmail = "preview-admin@example.test";
const adminPassword = `Pv-${randomBytes(9).toString("base64url")}9a!`;

mongod = await MongoMemoryServer.create({ instance: { dbName: "tharkoo" } });
const env = {
  ...process.env,
  MONGODB_URI: mongod.getUri("tharkoo"),
  SITE_URL: url,
  NEXT_PUBLIC_SITE_URL: url,
  SITE_NOINDEX: "true",
  STAGING_AUTO_VERIFY_EMAIL: "true",
  SESSION_SECRET: randomBytes(32).toString("hex"),
  CONTACT_ENCRYPTION_KEY: randomBytes(16).toString("hex"),
  ADMIN_BOOTSTRAP_EMAIL: adminEmail,
  ADMIN_BOOTSTRAP_PASSWORD: adminPassword,
  NODE_ENV: "production",
};

await run("npx", ["tsx", "scripts/seed.ts"], env);
await run("npx", ["next", "build"], { ...env, NODE_OPTIONS: "--max-old-space-size=4096" });
rmSync(".next/cache", { recursive: true, force: true });

mkdirSync(".relay", { recursive: true });
writeFileSync(
  ".relay/preview.txt",
  [
    `Preview link: ${url}`,
    `Admin: ${url}/admin/login/`,
    `Admin email: ${adminEmail}`,
    `Admin password: ${adminPassword}`,
    `Started: ${new Date().toISOString()}`,
    "Works only while `node scripts/preview.mjs` runs on this PC. Demo data only. Search engines are told not to index it.",
    "",
  ].join("\n"),
);
console.log(`[preview] public link: ${url}  (admin login in .relay/preview.txt)`);
const site = start("npx", ["next", "start", "-p", PORT, "-H", "127.0.0.1"], env);
site.on("exit", stop);
