import { readFileSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as boost from "@/app/api/cron/boost/route";
import * as contentPublish from "@/app/api/cron/content-publish/route";
import * as expire from "@/app/api/cron/expire/route";
import * as mediaPurge from "@/app/api/cron/media-purge/route";
import * as seoAudit from "@/app/api/cron/seo-audit/route";
import { assertCronAuth } from "@/server/shared/cron-auth";
import { connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/** H7.154: every cron route takes the scheduler's POST with x-cron-secret and Vercel Cron's GET with Authorization: Bearer. */

const SECRET = "h7154-test-secret-value";
const ROUTES = { boost, "content-publish": contentPublish, expire, "media-purge": mediaPurge, "seo-audit": seoAudit };
const LIGHT = ["boost", "content-publish", "media-purge"] as const;

const call = (method: "GET" | "POST", name: string, headers: Record<string, string> = {}) =>
  new Request(`http://localhost/api/cron/${name}`, { method, headers, ...(method === "POST" ? { body: "{}" } : {}) });

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  process.env.CRON_SECRET = SECRET;
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
afterEach(() => {
  process.env.CRON_SECRET = SECRET;
});

describe("every cron route refuses a caller without the secret", () => {
  for (const [name, route] of Object.entries(ROUTES)) {
    it(`${name}: no header, a wrong secret and a wrong Bearer give 401 on GET and POST`, async () => {
      for (const method of ["GET", "POST"] as const) {
        const handler = method === "GET" ? route.GET : route.POST;
        expect((await handler(call(method, name))).status).toBe(401);
        expect((await handler(call(method, name, { "x-cron-secret": "wrong" }))).status).toBe(401);
        expect((await handler(call(method, name, { authorization: "Bearer wrong" }))).status).toBe(401);
        expect((await handler(call(method, name, { authorization: `Basic ${SECRET}` }))).status).toBe(401);
        expect((await handler(call(method, name, { authorization: "Bearer " }))).status).toBe(401);
      }
    });
  }

  it("with no secret set on the server nobody gets in, even with an empty header", async () => {
    process.env.CRON_SECRET = "";
    for (const route of Object.values(ROUTES)) {
      expect((await route.GET(call("GET", "x", { authorization: "Bearer " }))).status).toBe(401);
      expect((await route.POST(call("POST", "x", { "x-cron-secret": "" }))).status).toBe(401);
    }
  });
});

describe("the routes run for the right secret", () => {
  for (const name of LIGHT) {
    it(`${name}: GET with the Bearer secret and POST with x-cron-secret both run and answer 200`, async () => {
      const route = ROUTES[name];
      const viaGet = await route.GET(call("GET", name, { authorization: `Bearer ${SECRET}` }));
      expect(viaGet.status).toBe(200);
      const viaPost = await route.POST(call("POST", name, { "x-cron-secret": SECRET }));
      expect(viaPost.status).toBe(200);
      expect((await viaGet.json()).ok).toBe(true);
    });
  }

  it("the answers and the error bodies never contain the secret", async () => {
    const bad = await boost.GET(call("GET", "boost", { authorization: `Bearer ${SECRET}x` }));
    expect(JSON.stringify(await bad.json())).not.toContain(SECRET);
    const good = await boost.GET(call("GET", "boost", { authorization: `Bearer ${SECRET}` }));
    expect(JSON.stringify(await good.json())).not.toContain(SECRET);
  });

  it("the expire route runs for the Bearer secret too", async () => {
    const response = await expire.GET(call("GET", "expire", { authorization: `Bearer ${SECRET}` }));
    expect(response.status).toBe(200);
  }, 120_000);
});

describe("the helper", () => {
  it("accepts either way in and rejects everything else", () => {
    expect(() => assertCronAuth(call("POST", "x", { "x-cron-secret": SECRET }))).not.toThrow();
    expect(() => assertCronAuth(call("GET", "x", { authorization: `Bearer ${SECRET}` }))).not.toThrow();
    expect(() => assertCronAuth(call("GET", "x", { authorization: `bearer ${SECRET}` }))).not.toThrow();
    expect(() => assertCronAuth(call("GET", "x"))).toThrow("Unauthorized");
    expect(() => assertCronAuth(call("GET", "x", { authorization: SECRET }))).toThrow("Unauthorized");
  });
});

describe("vercel.json schedules", () => {
  const config = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as { crons?: { path: string; schedule: string }[] };
  const crons = config.crons ?? [];

  it("calls expire and boost often and content-publish and media-purge once a day, each on a route that exists", () => {
    const byPath = Object.fromEntries(crons.map((row) => [row.path, row.schedule]));
    expect(Object.keys(byPath).sort()).toEqual(["/api/cron/boost", "/api/cron/content-publish", "/api/cron/expire", "/api/cron/media-purge"]);
    expect(byPath["/api/cron/expire"]).toBe("*/15 * * * *");
    expect(byPath["/api/cron/boost"]).toBe("*/15 * * * *");
    for (const path of ["/api/cron/content-publish", "/api/cron/media-purge"]) expect(byPath[path]).toMatch(/^\d+ \d+ \* \* \*$/);
    for (const row of crons) expect(Object.keys(ROUTES)).toContain(row.path.replace("/api/cron/", ""));
    for (const row of crons) expect(row.schedule.split(" ")).toHaveLength(5);
  });

  it("keeps the setting that stops branch deployments", () => {
    expect((config as { git?: { deploymentEnabled?: Record<string, boolean> } }).git?.deploymentEnabled?.["haiku/**"]).toBe(false);
  });
});
