import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { proxy } from "@/proxy";

const previous = process.env.MONGODB_URI;

beforeEach(() => {
  delete process.env.MONGODB_URI;
});

afterEach(() => {
  if (previous === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = previous;
});

function post(path: string, ip: string) {
  return proxy(new NextRequest(new URL(path, "http://127.0.0.1:4317"), { method: "POST", headers: { "x-forwarded-for": ip } }));
}

describe("payment provider webhooks skip the Origin check, and only those", () => {
  test("the coin webhook path accepts a POST with no Origin header", async () => {
    const res = await post("/api/payments/coins/webhook", `coin-hook-${Date.now()}-${Math.random()}`);
    expect(res.status).not.toBe(403);
  });

  test("the billing webhook path accepts a POST with no Origin header", async () => {
    const res = await post("/api/payments/webhook", `bill-hook-${Date.now()}-${Math.random()}`);
    expect(res.status).not.toBe(403);
  });

  test("other payment paths still refuse a POST with no Origin header", async () => {
    const res = await post("/api/payments/coins/checkout", `checkout-${Date.now()}-${Math.random()}`);
    expect(res.status).toBe(403);
  });

  test("a look-alike path does not get the exemption", async () => {
    const res = await post("/api/payments/coins/webhook/extra", `extra-${Date.now()}-${Math.random()}`);
    expect(res.status).toBe(403);
  });
});
