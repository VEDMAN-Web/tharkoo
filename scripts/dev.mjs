import { spawn } from "node:child_process";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = "4317";

function envLocalHasUri() {
  if (!existsSync(".env.local")) return false;
  return /MONGODB_URI=.+/.test(readFileSync(".env.local", "utf8"));
}

async function ensureUri() {
  const existing = process.env.MONGODB_URI || (envLocalHasUri() ? readFileSync(".env.local", "utf8").match(/MONGODB_URI=(.+)/)?.[1]?.trim() : "");
  if (existing && !existing.includes("127.0.0.1") && !existing.includes("localhost")) {
    return existing;
  }

  console.log("Starting in-memory MongoDB (use docker compose + npm run seed for a persistent local DB).");
  const mongod = await MongoMemoryServer.create({ instance: { dbName: "tharkoo" } });
  const uri = mongod.getUri("tharkoo");
  writeFileSync(
    ".env.local",
    `MONGODB_URI=${uri}\nNEXT_PUBLIC_SITE_URL=http://127.0.0.1:${PORT}\n`,
  );
  process.env.MONGODB_URI = uri;
  process.env.NEXT_PUBLIC_SITE_URL = `http://127.0.0.1:${PORT}`;
  globalThis.__tharkooMongo = mongod;
  return uri;
}

function run(cmd, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      env: { ...process.env, ...extraEnv },
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
  });
}

const uri = await ensureUri();
process.env.MONGODB_URI = uri;
await run("npx", ["tsx", "scripts/seed.ts"]);
await run("npx", ["next", "dev", "-p", PORT, "-H", "0.0.0.0"]);
