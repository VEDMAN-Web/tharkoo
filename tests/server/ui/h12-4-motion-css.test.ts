import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** H12.4 A2: light motion moves only transform and opacity (and colour on chips). It never animates width, height, top, left, margin or padding. */

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const FORBIDDEN = /\b(width|height|top|left|right|bottom|margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|inset)\b/;

/** The values of every `transition` / `transition-property` declaration, with the selector that owns them. */
function transitions(css: string): { selector: string; value: string }[] {
  const found: { selector: string; value: string }[] = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim().split("\n").pop()!.trim();
    for (const decl of match[2].split(";")) {
      const [prop, ...rest] = decl.split(":");
      if (prop && /^\s*transition(-property)?\s*$/.test(prop)) found.push({ selector, value: rest.join(":").trim() });
    }
  }
  return found;
}

/** The properties set inside every @keyframes block. */
function keyframeProps(css: string): { name: string; props: string[] }[] {
  const blocks: { name: string; props: string[] }[] = [];
  for (const match of css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)) {
    const props = [...match[2].matchAll(/([\w-]+)\s*:/g)].map((item) => item[1]);
    blocks.push({ name: match[1], props });
  }
  return blocks;
}

describe("H12.4 the motion rules move only transform and opacity", () => {
  for (const file of ["src/styles/motion.css", "src/styles/admin-kit.css"]) {
    it(`${file}: no transition or keyframe moves width, height, top, left, margin or padding`, () => {
      const css = read(file);
      // The header pill of the main menu (H8) has always slid its width along with its position; it is the one older rule left as it is.
      const bad = transitions(css).filter((item) => FORBIDDEN.test(item.value) && !item.selector.includes(".tkn-nav::before"));
      expect(bad, JSON.stringify(bad)).toEqual([]);
      const keys = keyframeProps(css).filter((block) => block.props.some((prop) => FORBIDDEN.test(prop)));
      expect(keys).toEqual([]);
    });
  }

  it("motion.css keeps every animation and transition inside prefers-reduced-motion: no-preference", () => {
    const css = read("src/styles/motion.css");
    // Top level = everything outside the no-preference block and outside @keyframes.
    const start = css.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(start).toBeGreaterThan(-1);
    let depth = 0;
    let end = start;
    for (let index = css.indexOf("{", start); index < css.length; index += 1) {
      if (css[index] === "{") depth += 1;
      if (css[index] === "}") depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
    const outside = (css.slice(0, start) + css.slice(end + 1)).replace(/@keyframes[\s\S]*?\n\}\n/g, "");
    expect(outside).not.toMatch(/\banimation(-name|-duration)?\s*:/);
    expect(outside).not.toMatch(/\btransition(-property|-duration)?\s*:/);
  });

  it("admin-kit.css puts the H12.4 admin motion (drawer, save bar, row flash) inside no-preference too", () => {
    const css = read("src/styles/admin-kit.css");
    const open = css.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(open).toBeGreaterThan(-1);
    const block = css.slice(open);
    for (const name of ["adm-k-drawer-in", "adm-k-bar-in", "adm-k-flash"]) expect(block).toContain(name);
    // Before that block the drawer and the save bar have no animation of their own.
    expect(css.slice(0, open)).not.toMatch(/\.adm-k-(drawer|savebar)[^{]*\{[^}]*animation/);
  });

  it("the hero and the first screen stay still: no reveal, lift or fade rule targets the hero or the h1", () => {
    const css = read("src/styles/motion.css");
    expect(css).not.toMatch(/\.tkh-hero|\.tk-hero|\bh1\b/);
  });
});
