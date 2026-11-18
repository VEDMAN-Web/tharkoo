import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizePathname } from "@/lib/site-path";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const slashes = (file: string) => file.split("\\").join("/");

describe("the page address is the same on the server and in the browser (H10.3b, React error 418)", () => {
  it("turns what a prerendered page reports into what the browser reports", () => {
    expect(normalizePathname("/index")).toBe("/");
    expect(normalizePathname("/index/")).toBe("/");
    expect(normalizePathname("/")).toBe("/");
    expect(normalizePathname("")).toBe("/");
    expect(normalizePathname(null)).toBe("/");
    expect(normalizePathname("/categories")).toBe("/categories/");
    expect(normalizePathname("/categories/")).toBe("/categories/");
    expect(normalizePathname("/dating/bengaluru")).toBe("/dating/bengaluru/");
    expect(normalizePathname("blog")).toBe("/blog/");
  });

  it("no public component reads the address with usePathname directly: they all use useSitePath", () => {
    const offenders = ["src/components", "src/app"]
      .flatMap((root) => files(root))
      .map(slashes)
      .filter((file) => !file.includes("/admin/") && !file.endsWith("useSitePath.ts"))
      .filter((file) => /\busePathname\s*\(/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
