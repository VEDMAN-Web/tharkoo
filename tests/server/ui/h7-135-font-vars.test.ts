import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");

function selfReferences(css: string) {
  const found: string[] = [];
  for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    const [, name, value] = match;
    const refs = [...value.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((ref) => ref[1]);
    if (refs.includes(name)) found.push(name);
  }
  return found;
}

describe("font variables (H7.135)", () => {
  it("no custom property in the site or admin styles is defined in terms of itself", () => {
    for (const file of ["src/app/globals.css", "src/styles/tokens.css", "src/styles/admin.css", "src/styles/admin-kit.css"]) {
      expect(selfReferences(read(file)), file).toEqual([]);
    }
  });

  it("next/font writes its own names, and the theme tokens point at them", () => {
    const fonts = read("src/styles/fonts.ts");
    const css = read("src/app/globals.css");
    expect(fonts).toContain('variable: "--font-display-src"');
    expect(fonts).toContain('variable: "--font-sans-src"');
    expect(fonts).not.toMatch(/variable: "--font-(display|sans)"/);
    expect(css).toContain('--font-display: var(--font-display-src), "Cormorant Garamond", serif;');
    expect(css).toContain("--font-sans: var(--font-sans-src), Manrope, sans-serif;");
    expect(css).toMatch(/:root \{\s*--font-display: var\(--font-display-src\)[^;]*;\s*--font-sans: var\(--font-sans-src\)[^;]*;\s*\}/);
  });
});
