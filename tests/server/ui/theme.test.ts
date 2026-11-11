import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function lin(channel: number) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const r = lin((n >> 16) & 255);
  const g = lin((n >> 8) & 255);
  const b = lin(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const hi = Math.max(luminance(a), luminance(b));
  const lo = Math.min(luminance(a), luminance(b));
  return (hi + 0.05) / (lo + 0.05);
}

function tokens() {
  const css = readFileSync(path.join(root, "src/styles/tokens.css"), "utf8");
  const map = new Map<string, string>();
  for (const match of css.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) map.set(match[1], match[2]);
  return { css, map };
}

/** The spec names the previous theme. Two read-only server files use "midnight" for UTC date math. */
const ALLOW = new Set([
  "docs/design/CLONE_SPEC.md",
  "src/server/listings/service.ts",
  "src/server/shared/age.ts",
]);

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe("light theme", () => {
  it("declares a light colour scheme", () => {
    const { css } = tokens();
    expect(css).toContain("color-scheme: light");
    expect(css.toLowerCase()).not.toContain("dark");
  });

  it("keeps text contrast at 4.5 or better", () => {
    const { map } = tokens();
    const pair = (fg: string, bg: string) => contrast(map.get(fg) || fg, map.get(bg) || bg);
    const pairs: [string, string][] = [
      ["--text", "--bg"],
      ["--body", "--card"],
      ["--muted", "--card"],
      ["--accent", "--bg"],
      ["--accent", "--tint-strong"],
      ["--on-primary", "--primary"],
      ["--on-accent", "--accent"],
      ["#ffffff", "--wa"],
      ["--ok", "--ok-bg"],
      ["--danger", "--card"],
      ["--primary", "--tint"],
    ];
    for (const [fg, bg] of pairs) {
      expect(pair(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps page surfaces light", () => {
    const { css } = tokens();
    for (const match of css.matchAll(/(--(?:bg[\w-]*|card|tint[\w-]*|chip|bar|letterbox)):\s*(#[0-9a-fA-F]{6})/g)) {
      expect(luminance(match[2]), match[1]).toBeGreaterThanOrEqual(0.8);
    }
  });

  it("uses Cormorant Garamond and Manrope only", () => {
    const src = readFileSync(path.join(root, "src/styles/fonts.ts"), "utf8");
    expect(src).toContain("Cormorant_Garamond");
    expect(src).toContain("Manrope");
    expect(src.match(/from "next\/font\/google"/g)?.length).toBe(1);
    expect(src).not.toMatch(/Inter|Roboto|Geist/);
  });

  it("does not keep the old theme name in product files", () => {
    const hits: string[] = [];
    for (const folder of ["src", "docs", "public"]) {
      for (const file of walk(path.join(root, folder))) {
        const rel = path.relative(root, file).split(path.sep).join("/");
        if (ALLOW.has(rel)) continue;
        if (/\.(png|webp|jpg|jpeg|gif|woff2?)$/i.test(file)) continue;
        const text = readFileSync(file, "utf8");
        if (/champagne|midnight|#0b0b0e/i.test(text)) hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
    const service = readFileSync(path.join(root, "src/server/listings/service.ts"), "utf8");
    expect(service).toContain("const midnight = Date.UTC");
    const age = readFileSync(path.join(root, "src/server/shared/age.ts"), "utf8");
    expect(age).toMatch(/UTC midnight/);
  });
});
