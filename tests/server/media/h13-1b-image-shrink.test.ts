import { describe, expect, it } from "vitest";
import { MAX_LONG_SIDE, UNREADABLE_PHOTO, shrinkPhoto, type ShrinkDeps } from "@/lib/image-shrink";

/** H13.1 part 2: photos of any size are made to fit before they are sent. The browser's canvas is replaced by a fake that sizes a file from its pixels and quality. */

const MB = 1024 * 1024;
const LIMIT = 8 * MB;

function photo(bytes: number, name = "IMG_0001.jpg", type = "image/jpeg") {
  return new File([new Uint8Array(bytes)], name, { type });
}

/** A fake picture of this size. `bytesFor` says how big the saved file is, so the tests can make a try fit or not. */
function fakeDeps(width: number, height: number, bytesFor: (w: number, h: number, quality: number) => number = (w, h, q) => Math.round(w * h * q * 0.4)) {
  const calls: { width: number; height: number; type: string; quality: number }[] = [];
  const deps: ShrinkDeps = {
    async read() {
      return { width, height };
    },
    async encode(w, h, type, quality) {
      calls.push({ width: w, height: h, type, quality });
      return new Blob([new Uint8Array(bytesFor(w, h, quality))], { type });
    },
  };
  return { deps, calls };
}

describe("H13.1 A5a: shrinking a photo before it is sent", () => {
  it("a 6000 x 4000 photo comes out with the long side 2560, as a JPEG, and under the limit", async () => {
    const { deps, calls } = fakeDeps(6000, 4000);
    const done = await shrinkPhoto(photo(12 * MB), LIMIT, deps);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.changed).toBe(true);
    expect(done.file.size).toBeLessThanOrEqual(LIMIT);
    expect(done.file.type).toBe("image/jpeg");
    expect(done.file.name).toBe("IMG_0001.jpg");
    expect(calls[0]).toMatchObject({ width: 2560, height: 1707, type: "image/jpeg", quality: 0.85 });
    expect(Math.max(calls[0].width, calls[0].height)).toBe(MAX_LONG_SIDE);
  });

  it("a 1000 x 800 photo under the limit is returned unchanged: the very same file, nothing drawn", async () => {
    const { deps, calls } = fakeDeps(1000, 800);
    const file = photo(1 * MB);
    const done = await shrinkPhoto(file, LIMIT, deps);
    expect(done).toEqual({ ok: true, file, changed: false });
    if (done.ok) expect(done.file).toBe(file);
    expect(calls).toEqual([]);
  });

  it("a photo that is small in pixels but over the limit in bytes is saved again at its own size (never made bigger)", async () => {
    const { deps, calls } = fakeDeps(1200, 900);
    const done = await shrinkPhoto(photo(9 * MB, "scan.png", "image/png"), LIMIT, deps);
    expect(done.ok && done.file.name).toBe("scan.jpg");
    expect(calls.every((call) => call.width === 1200 && call.height === 900)).toBe(true);
  });

  it("a photo over 2560 px but under the limit in bytes is made 2560 px wide, a portrait one 2560 tall", async () => {
    const wide = fakeDeps(4000, 3000, () => 2 * MB);
    expect((await shrinkPhoto(photo(5 * MB), LIMIT, wide.deps)).ok).toBe(true);
    expect(wide.calls[0]).toMatchObject({ width: 2560, height: 1920 });
    const tall = fakeDeps(3000, 4000, () => 2 * MB);
    await shrinkPhoto(photo(5 * MB), LIMIT, tall.deps);
    expect(tall.calls[0]).toMatchObject({ width: 1920, height: 2560 });
  });

  it("steps the quality down (0.85, 0.8, 0.75, 0.7) and then the long side (2560, 2048, 1600) until the file fits", async () => {
    // Only a 1600 px picture is small enough: every bigger try is over the limit.
    const { deps, calls } = fakeDeps(6000, 4000, (w) => (w <= 1600 ? 3 * MB : 20 * MB));
    const done = await shrinkPhoto(photo(30 * MB), LIMIT, deps);
    expect(done.ok).toBe(true);
    expect(calls.map((call) => [call.width, call.quality])).toEqual([
      [2560, 0.85], [2560, 0.8], [2560, 0.75], [2560, 0.7],
      [2048, 0.85], [2048, 0.8], [2048, 0.75], [2048, 0.7],
      [1600, 0.85],
    ]);
  });

  it("a WEBP stays a WEBP", async () => {
    const { deps, calls } = fakeDeps(5000, 3000);
    const done = await shrinkPhoto(photo(10 * MB, "shop.webp", "image/webp"), LIMIT, deps);
    expect(done.ok && done.file.type).toBe("image/webp");
    expect(done.ok && done.file.name).toBe("shop.webp");
    expect(calls[0].type).toBe("image/webp");
  });

  it("a photo that cannot be read, or cannot be made to fit at all, says so in plain words", async () => {
    const broken: ShrinkDeps = { async read() { return null; }, async encode() { return null; } };
    expect(await shrinkPhoto(photo(1000), LIMIT, broken)).toEqual({ ok: false, error: UNREADABLE_PHOTO });
    expect(UNREADABLE_PHOTO).toBe("This photo could not be read. Try another photo or take a screenshot of it.");
    const hopeless = fakeDeps(6000, 4000, () => 50 * MB);
    expect(await shrinkPhoto(photo(60 * MB), LIMIT, hopeless.deps)).toEqual({ ok: false, error: UNREADABLE_PHOTO });
    const throws: ShrinkDeps = { async read() { throw new Error("boom"); }, async encode() { return null; } };
    expect(await shrinkPhoto(photo(1000), LIMIT, throws)).toEqual({ ok: false, error: UNREADABLE_PHOTO });
  });
});
