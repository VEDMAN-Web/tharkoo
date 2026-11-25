import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shell = readFileSync("src/components/post/post-shell.css", "utf8");
const done = readFileSync("src/components/post/post-success.css", "utf8");

/** The text of a rule that starts with the selector, up to its closing brace. */
function rule(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return "";
  return css.slice(start, css.indexOf("}", start) + 1);
}

describe("H21.7b the post-ad header on a phone", () => {
  it("shows the logo on every screen size, on the left", () => {
    const base = rule(shell, ".tkn .tkp-shell .tkp-logo");
    expect(base).toContain("display: inline-flex");
    expect(base).not.toContain("display: none");
    expect(base).toContain("order: 0");
  });

  it("lets the title shrink instead of pushing the logo or the pill off a narrow phone", () => {
    const mid = rule(shell, ".tkn .tkp-shell .tkp-header-mid");
    expect(mid).toContain("min-width: 0");
    expect(mid).toContain("text-overflow: ellipsis");
  });
});

describe("H21.7b a very narrow phone", () => {
  it("drops the title so the logo, the back arrow and the pill fit", () => {
    const at = shell.indexOf("@media (max-width: 479px)");
    expect(at).toBeGreaterThan(0);
    expect(shell.slice(at, at + 400)).toContain(".tkp-header-mid { display: none; }");
  });
});

describe("H21.7b the done screens and the support bubble", () => {
  it("leaves room under the page for the 56 px bubble plus 16 px, and puts the bubble 16 px from the bottom", () => {
    expect(done).toContain("  body:has(.tkdn) .tkn-float { bottom: 16px; }");
    expect(done).toMatch(/\.tkdn \{ padding-bottom: calc\(56px \+ 16px \+ 16px/);
  });
});
