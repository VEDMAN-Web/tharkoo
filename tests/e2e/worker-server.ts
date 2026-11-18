import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { cpSync, existsSync, mkdirSync, openSync, rmSync, symlinkSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

/**
 * H10.5b: one private server per Playwright worker.
 *
 * The suite shares one site-wide state (settings, page layouts, prices, queues, counters), so two workers on one
 * server step on each other. With more than one worker, each worker starts its own in-memory MongoDB, its own seeded
 * data, its own copy of the build (the page cache and the uploads folder live inside it) and its own port.
 * Nothing is shared between workers, so a test can change any setting without touching another worker's run.
 */

export type WorkerServer = { url: string; mongoUriFile: string; appDir: string; stop: () => Promise<void> };

const SKIPPED_BUILD_PARTS = new Set(["cache", "standalone", "types", "dev", "diagnostics"]);

function copyBuild(appDir: string) {
  const root = resolve(".next");
  if (!existsSync(join(root, "BUILD_ID"))) throw new Error("Run the build first: tests/e2e needs a production build in .next");
  cpSync(root, join(appDir, ".next"), {
    recursive: true,
    filter: (source) => {
      const top = relative(root, source).split(sep)[0];
      return !SKIPPED_BUILD_PARTS.has(top);
    },
  });
  cpSync(resolve("package.json"), join(appDir, "package.json"));
  cpSync(resolve("next.config.ts"), join(appDir, "next.config.ts"));
  if (existsSync(resolve("tsconfig.json"))) cpSync(resolve("tsconfig.json"), join(appDir, "tsconfig.json"));
  cpSync(resolve("public"), join(appDir, "public"), {
    recursive: true,
    filter: (source) => relative(resolve("public"), source).split(sep)[0] !== "uploads",
  });
  mkdirSync(join(appDir, "public", "uploads"), { recursive: true });
  symlinkSync(resolve("node_modules"), join(appDir, "node_modules"), "junction");
}

async function waitUntilUp(url: string, child: ChildProcess, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`the worker server exited with code ${child.exitCode} before it was ready`);
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      /* not up yet */
    }
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error(`the worker server did not answer at ${url} within ${Math.round(timeoutMs / 1000)}s`);
}

function killTree(child: ChildProcess) {
  if (child.pid === undefined || child.exitCode !== null) return;
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-child.pid, "SIGTERM");
  } catch {
    /* already gone */
  }
}

/** Starts the seeded production server for one worker. `index` is the worker's parallel index (0, 1, ...). */
export async function startWorkerServer(index: number, basePort: number): Promise<WorkerServer> {
  const port = basePort + 1 + index;
  const url = `http://127.0.0.1:${port}`;
  const appDir = resolve(".shots/e2e", `worker-${index}`);
  const mongoUriFile = resolve(".shots/e2e", `mongo-uri-w${index}.txt`);
  rmSync(appDir, { recursive: true, force: true });
  mkdirSync(appDir, { recursive: true });
  copyBuild(appDir);

  const log = openSync(resolve(".shots/e2e", `worker-${index}.log`), "w");
  const child = spawn(process.execPath, ["tests/e2e/server.mjs"], {
    stdio: ["ignore", log, log],
    detached: process.platform !== "win32",
    env: { ...process.env, E2E_PORT: String(port), E2E_MONGO_URI_FILE: mongoUriFile, E2E_APP_DIR: appDir },
  });
  try {
    await waitUntilUp(`${url}/`, child, 240_000);
  } catch (error) {
    killTree(child);
    throw error;
  }
  return {
    url,
    mongoUriFile,
    appDir,
    stop: async () => {
      killTree(child);
      rmSync(appDir, { recursive: true, force: true });
    },
  };
}
