import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STALE_LIMIT_MS, cached, invalidateTags } from "@/lib/cache";

/** H17.2: an entry past its time is answered from the held copy while it refreshes once in the background. */

const TTL = 10_000;
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T10:00:00Z"));
  invalidateTags(["t"]);
});
afterEach(() => {
  vi.useRealTimers();
  invalidateTags(["t"]);
});

describe("cache with a stale window", () => {
  it("answers from the cache while it is fresh and loads once", async () => {
    const load = vi.fn(async () => "one");
    expect(await cached("k-fresh", TTL, load, ["t"])).toBe("one");
    expect(await cached("k-fresh", TTL, load, ["t"])).toBe("one");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("past its time it answers at once with the held copy and refreshes once in the background", async () => {
    let value = "old";
    const load = vi.fn(async () => value);
    await cached("k-stale", TTL, load, ["t"]);
    value = "new";
    vi.setSystemTime(Date.now() + TTL + 1);
    const both = await Promise.all([cached("k-stale", TTL, load, ["t"]), cached("k-stale", TTL, load, ["t"])]);
    expect(both).toEqual(["old", "old"]);
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(await cached("k-stale", TTL, load, ["t"])).toBe("new");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("a change that clears the tags is never answered from the old copy", async () => {
    let value = "old";
    const load = vi.fn(async () => value);
    await cached("k-clear", TTL, load, ["t"]);
    vi.setSystemTime(Date.now() + TTL + 1);
    value = "changed";
    invalidateTags(["t"]);
    expect(await cached("k-clear", TTL, load, ["t"])).toBe("changed");
  });

  it("beyond the stale window it waits for a fresh load", async () => {
    let value = "old";
    const load = vi.fn(async () => value);
    await cached("k-window", TTL, load, ["t"]);
    value = "fresh";
    vi.setSystemTime(Date.now() + TTL + Math.min(STALE_LIMIT_MS, TTL * 10) + 1);
    expect(await cached("k-window", TTL, load, ["t"])).toBe("fresh");
  });

  it("a failed background refresh keeps serving the held copy and tries again on the next request", async () => {
    let fail = false;
    const load = vi.fn(async () => {
      if (fail) throw new Error("database is busy");
      return "held";
    });
    await cached("k-fail", TTL, load, ["t"]);
    vi.setSystemTime(Date.now() + TTL + 1);
    fail = true;
    expect(await cached("k-fail", TTL, load, ["t"])).toBe("held");
    await flush();
    fail = false;
    expect(await cached("k-fail", TTL, load, ["t"])).toBe("held");
    await flush();
    expect(load).toHaveBeenCalledTimes(3);
  });
});
