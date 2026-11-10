import { NextRequest } from "next/server";
import { afterEach, describe, expect, test } from "vitest";
import { proxy } from "@/proxy";

const previous = process.env.MONGODB_URI;

afterEach(() => {
  if (previous === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = previous;
});

function call(url: string, headers: Record<string, string> = {}, method = "GET") {
  return proxy(new NextRequest(new URL(url, "http://127.0.0.1:4317"), { method, headers }));
}

describe("site rate limit", () => {
  test("prefetch and logo do not consume the bucket, a document request does", async () => {
    delete process.env.MONGODB_URI;
    const ip = `ui-${Date.now()}-${Math.random()}`;
    const headers = { "x-forwarded-for": ip };
    for (let i = 0; i < 300; i++) {
      const res = await call(`/?_rsc=${i}`, { ...headers, "next-router-prefetch": "1" });
      expect(res.status).toBe(200);
    }
    for (let i = 0; i < 40; i++) {
      const res = await call("/logo.svg", headers);
      expect(res.status).toBe(200);
    }
    const first = await call("/", headers);
    expect(first.status).toBe(200);
    let last = 200;
    for (let i = 0; i < 250; i++) {
      const res = await call("/help/", headers);
      last = res.status;
    }
    expect(last).toBe(429);
  });

  test("cron posts are not rejected for a missing origin", async () => {
    delete process.env.MONGODB_URI;
    const res = await call("/api/cron/expire", { "x-forwarded-for": `cron-${Date.now()}` }, "POST");
    expect(res.status).not.toBe(403);
  });
});
