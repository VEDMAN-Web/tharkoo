import { spawn } from "node:child_process";
import { cpSync, existsSync, writeFileSync } from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";

const uriFile = "/tmp/tharkoo-e2e-mongo-uri";
const standalone = ".next/standalone";

if (!existsSync(`${standalone}/server.js`)) {
  console.error("Missing .next/standalone/server.js. Run npm run build first.");
  process.exit(1);
}

const mongod = await MongoMemoryServer.create();
const uri = mongod.getUri("tharkoo");
writeFileSync(uriFile, uri);

cpSync(".next/static", `${standalone}/.next/static`, { recursive: true });
if (existsSync("public")) cpSync("public", `${standalone}/public`, { recursive: true });

const child = spawn(process.execPath, ["server.js"], {
  cwd: standalone,
  stdio: "inherit",
  env: {
    ...process.env,
    MONGODB_URI: uri,
    NODE_OPTIONS: process.env.NODE_OPTIONS?.includes("max-old-space-size")
      ? process.env.NODE_OPTIONS
      : `${process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ` : ""}--max-old-space-size=256`,
    PORT: "4317",
    HOSTNAME: "0.0.0.0",
    SITE_NOINDEX: process.env.SITE_NOINDEX || "true",
    STAGING_AUTO_VERIFY_EMAIL: process.env.STAGING_AUTO_VERIFY_EMAIL || "true",
    NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:4317",
    COOKIE_SECURE: process.env.COOKIE_SECURE || "false",
    SITE_RATE_MAX: process.env.SITE_RATE_MAX || "4000",
    SEARCH_RATE_MAX: process.env.SEARCH_RATE_MAX || "400",
    ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL || "homepage-admin@example.test",
    ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD || "HomepageAdmin1!",
  },
});

async function shutdown(code) {
  if (!child.killed) child.kill("SIGTERM");
  await mongod.stop();
  process.exit(code);
}

child.on("exit", (code) => {
  shutdown(code ?? 0).catch(() => process.exit(code ?? 1));
});
process.on("SIGTERM", () => {
  shutdown(0).catch(() => process.exit(0));
});
process.on("SIGINT", () => {
  shutdown(0).catch(() => process.exit(0));
});
