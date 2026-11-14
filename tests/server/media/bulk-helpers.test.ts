import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { runLimited } from "@/server/media/run-limited";
import { readZipImages } from "@/server/media/zip-images";
import { altFromFileName, AUTO_ALT_MAX } from "@/server/media/alt-from-filename";
import { BATCH_MAX_BYTES, BATCH_MAX_FILES, BATCH_PARALLEL, checkBatch } from "@/server/media/batch";

const file = (name: string, size = 1000, type = "image/jpeg") => ({ name, size, type });

describe("filename to alt text", () => {
  it("turns red-sofa_01.jpg into Red sofa", () => {
    expect(altFromFileName("red-sofa_01.jpg")).toBe("Red sofa");
  });

  it("drops the folder, the extension and a copy number", () => {
    expect(altFromFileName("C:\\photos\\Living room (2).webp")).toBe("Living room");
    expect(altFromFileName("/tmp/flat_a.jpeg")).toBe("Flat a");
  });

  it("keeps numbers that are not a trailing copy number", () => {
    expect(altFromFileName("IMG_2034.JPG")).toBe("Img 2034");
    expect(altFromFileName("kitchen-03-final.png")).toBe("Kitchen 03 final");
  });

  it("falls back to Image when nothing usable is left", () => {
    expect(altFromFileName("___.jpg")).toBe("Image");
    expect(altFromFileName("a.jpg")).toBe("Image");
  });

  it("never returns more than the alt text limit", () => {
    const long = `${"word-".repeat(60)}end.jpg`;
    const alt = altFromFileName(long);
    expect(alt.length).toBeLessThanOrEqual(AUTO_ALT_MAX);
    expect(alt.length).toBeGreaterThanOrEqual(3);
  });
});

describe("batch check", () => {
  it("accepts up to 50 files and refuses the rest with a reason", () => {
    const files = Array.from({ length: 51 }, (_, index) => file(`pic-${index}.jpg`));
    const result = checkBatch(files);
    expect(BATCH_MAX_FILES).toBe(50);
    expect(result.accepted).toHaveLength(50);
    expect(result.rejected).toEqual([expect.objectContaining({ name: "pic-50.jpg", reason: expect.stringMatching(/50 files/) })]);
  });

  it("refuses other types, files over 8 MB and empty files, and does not send them", () => {
    const result = checkBatch([
      file("ok.png", 10, "image/png"),
      file("anim.gif", 10, "image/gif"),
      file("vector.svg", 10, "image/svg+xml"),
      file("huge.jpg", BATCH_MAX_BYTES + 1),
      file("empty.jpg", 0),
    ]);
    expect(result.accepted.map((item) => item.name)).toEqual(["ok.png"]);
    expect(result.rejected.map((item) => item.name)).toEqual(["anim.gif", "vector.svg", "huge.jpg", "empty.jpg"]);
    expect(result.rejected[2].reason).toMatch(/8 MB/);
  });

  it("reads the type from the extension when the browser gives none", () => {
    const result = checkBatch([file("flat.webp", 10, ""), file("notes.txt", 10, "")]);
    expect(result.accepted.map((item) => item.name)).toEqual(["flat.webp"]);
  });

  it("uploads three at a time", () => {
    expect(BATCH_PARALLEL).toBe(3);
  });
});

describe("runLimited", () => {
  it("never runs more than the limit at once and finishes every item", async () => {
    let running = 0;
    let peak = 0;
    const seen: number[] = [];
    await runLimited([1, 2, 3, 4, 5, 6, 7, 8], 3, async (item) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 2));
      seen.push(item);
      running -= 1;
    });
    expect(peak).toBe(3);
    expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("does nothing for an empty list", async () => {
    let calls = 0;
    await runLimited([], 3, async () => {
      calls += 1;
    });
    expect(calls).toBe(0);
  });
});

/** A small ZIP writer for the tests: stored or deflated entries, plus any name you give it. */
function zipOf(entries: Array<{ name: string; data?: Buffer; deflate?: boolean }>) {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = entry.data ?? Buffer.alloc(0);
    const method = entry.deflate ? 8 : 0;
    const packed = entry.deflate ? deflateRawSync(raw) : raw;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(name.length, 26);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0);
    head.writeUInt16LE(method, 10);
    head.writeUInt32LE(packed.length, 20);
    head.writeUInt32LE(raw.length, 24);
    head.writeUInt16LE(name.length, 28);
    head.writeUInt32LE(offset, 42);
    parts.push(local, name, packed);
    central.push(head, name);
    offset += local.length + name.length + packed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}

const arrayBufferOf = (buffer: Buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

describe("ZIP of images", () => {
  it("returns the images, stored or deflated, and skips folders, hidden files and macOS metadata", async () => {
    const red = Buffer.from("red image bytes");
    const blue = Buffer.from("blue image bytes, blue image bytes, blue image bytes");
    const zip = zipOf([
      { name: "flat1/" },
      { name: "flat1/red-sofa_01.jpg", data: red },
      { name: "flat1/blue-sofa_02.png", data: blue, deflate: true },
      { name: "__MACOSX/flat1/._red-sofa_01.jpg", data: Buffer.from("junk") },
      { name: "flat1/.DS_Store", data: Buffer.from("junk") },
    ]);
    const entries = await readZipImages(arrayBufferOf(zip));
    expect(entries.map((entry) => entry.name)).toEqual(["red-sofa_01.jpg", "blue-sofa_02.png"]);
    expect(Buffer.from(entries[0].data).equals(red)).toBe(true);
    expect(Buffer.from(entries[1].data).equals(blue)).toBe(true);
  });

  it("refuses bytes that are not a ZIP file", async () => {
    await expect(readZipImages(arrayBufferOf(Buffer.from("this is not a zip file at all, just text")))).rejects.toThrow(/not a ZIP/);
  });
});
