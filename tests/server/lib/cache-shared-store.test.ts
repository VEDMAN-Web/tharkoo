import { describe, expect, it, vi } from "vitest";

/** H7.138: Next builds each route as its own bundle. The in-memory cache must be one store for the process, or an admin save cannot clear what Home reads. */
describe("the in-memory cache is shared by every copy of the module", () => {
  it("clears an entry made through another copy of the module", async () => {
    const first = await import("@/lib/cache");
    vi.resetModules();
    const second = await import("@/lib/cache");
    expect(second).not.toBe(first);

    let calls = 0;
    const load = () => first.cached("h7138-shared", 60_000, async () => ++calls, ["feed"]);
    expect(await load()).toBe(1);
    expect(await load()).toBe(1);
    second.invalidateTags(["feed"]);
    expect(await load()).toBe(2);
  });
});
