import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  headers: async () => new Headers({ "user-agent": "Mozilla/5.0 Chrome/140" }),
}));
import { createRedirectFrom404Action } from "@/app/admin/urls/notfound-actions";
import { MAX_404_PATHS_PER_DAY, NotFoundDay } from "@/server/models/seo";
import { Redirect } from "@/server/models/cms";
import { isBot, listNotFound, logNotFound, refDomainOf, shouldLog, total404Hits } from "@/server/seo/notfound-log";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

function resetDbCache() {
  const g = globalThis as { mongoose?: { conn: unknown; promise: unknown } };
  if (g.mongoose) {
    g.mongoose.conn = null;
    g.mongoose.promise = null;
  }
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  resetDbCache();
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
  resetDbCache();
});
beforeEach(clearMemoryMongo);

const day1 = new Date("2026-11-10T10:00:00Z");
const day2 = new Date("2026-11-11T10:00:00Z");

describe("404 log helpers", () => {
  it("skips build files, assets, admin and api paths", () => {
    expect(shouldLog("/jobs/missing/")).toBe(true);
    for (const path of ["/_next/static/a.js", "/admin/x/", "/api/x", "/u/account", "/logo.png", "/favicon.ico", "/robots.txt", "/x".repeat(200)]) {
      expect(shouldLog(path)).toBe(false);
    }
    expect(shouldLog("no-slash")).toBe(false);
  });

  it("tells bots from people and reads the referrer domain", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("Mozilla/5.0 (Windows NT 10.0) Chrome/140")).toBe(false);
    expect(refDomainOf("https://News.Example.com/a?b=1")).toBe("news.example.com");
    expect(refDomainOf("not a url")).toBe("");
    expect(refDomainOf(null)).toBe("");
  });
});

describe("404 counting", () => {
  it("counts three visits to a missing URL as three hits with one row per day", async () => {
    for (let i = 0; i < 3; i++) await logNotFound({ path: "/gone/", userAgent: "Chrome", referer: "https://a.example/x", now: day1 });
    const rows = await listNotFound(7, day1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ path: "/gone/", hits: 3, botHits: 0, humanHits: 3, refDomain: "a.example" });
    expect(await NotFoundDay.countDocuments()).toBe(1);
  });

  it("separates bot hits and adds days together", async () => {
    await logNotFound({ path: "/gone/", userAgent: "Googlebot", now: day1 });
    await logNotFound({ path: "/gone/", userAgent: "Chrome", now: day2 });
    await logNotFound({ path: "/gone/?utm=1", userAgent: "Chrome", now: day2 });
    const [row] = await listNotFound(7, day2);
    expect(row).toMatchObject({ hits: 3, botHits: 1, humanHits: 2, lastDay: "2026-11-11" });
    expect(await total404Hits(7, day2)).toBe(3);
  });

  it("leaves old days out of the window and ignores skipped paths", async () => {
    await logNotFound({ path: "/old/", now: new Date("2026-10-01T00:00:00Z") });
    await logNotFound({ path: "/_next/x.js", now: day1 });
    expect(await listNotFound(7, day1)).toEqual([]);
  });

  it("stops adding new paths at the daily cap but keeps counting known ones", async () => {
    await NotFoundDay.insertMany(Array.from({ length: MAX_404_PATHS_PER_DAY }, (_, i) => ({ day: "2026-11-10", path: `/p${i}/`, hits: 1 })));
    expect(await logNotFound({ path: "/one-more/", now: day1 })).toBe(false);
    expect(await logNotFound({ path: "/p1/", now: day1 })).toBe(true);
    expect(await NotFoundDay.countDocuments({ day: "2026-11-10" })).toBe(MAX_404_PATHS_PER_DAY);
  });

  it("never throws when the log fails", async () => {
    await mongoose.disconnect();
    resetDbCache();
    const original = process.env.MONGODB_URI;
    process.env.MONGODB_URI = "mongodb://127.0.0.1:1/none?serverSelectionTimeoutMS=200";
    expect(await logNotFound({ path: "/x/", now: day1 })).toBe(false);
    if (original === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = original;
    resetDbCache();
    await connectMemoryMongo();
  }, 20000);
});

describe("create 301 from a 404", () => {
  it("needs an SEO role", async () => {
    const out = await createRedirectFrom404Action("/gone/", "/new/");
    expect(out.ok).toBe(false);
    expect(await Redirect.countDocuments()).toBe(0);
  });
});

describe("404 beacon", () => {
  it("logs the path sent by the browser, not request headers", async () => {
    const { recordNotFoundAction } = await import("@/app/admin/urls/notfound-beacon");
    await recordNotFoundAction("/browser-sent/?x=1", "https://ref.example/page");
    const rows = await listNotFound(7);
    expect(rows.map((row) => row.path)).toContain("/browser-sent/");
    expect(rows.find((row) => row.path === "/browser-sent/")?.refDomain).toBe("ref.example");
    await recordNotFoundAction("/_next/static/x.js", "");
    expect((await listNotFound(7)).some((row) => row.path.startsWith("/_next"))).toBe(false);
  });
});
