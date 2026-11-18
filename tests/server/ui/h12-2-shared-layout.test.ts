import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("H12.2 shared layout rules", () => {
  it("one chip-row utility: sideways scroll, snap, a 24 px fade and no scrollbar", () => {
    const css = read("src/app/globals.css");
    const block = css.slice(css.indexOf(".tk-chips-scroll {"));
    expect(block).toContain("overflow-x: auto");
    expect(block).toContain("scroll-snap-type: x proximity");
    expect(block).toContain("mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent)");
    expect(block).toContain("scrollbar-width: none");
  });

  it("ad cards pin the tags to the bottom edge and keep two lines of title height on a phone", () => {
    const css = read("src/components/new/home-ads.css");
    expect(css).toContain(".tkh-ad .tkh-ad-body > .tkh-ad-pills { margin-top: auto;");
    expect(css).toContain(".tkh-ad .tkh-ad-title { min-height: 2.7em; }");
  });

  it("the 18+ pop-up focuses the enter button and keeps its wording", () => {
    const source = read("src/components/AgeGate.tsx");
    expect(source).toContain("acceptRef.current?.focus()");
    expect(source).toContain('data-tk="age-accept"');
    expect(source).toContain("I am 18 or older, enter");
    expect(source).toContain("Please confirm your age before continuing");
    expect(source).toContain("box-decoration-break: clone");
  });

  it("the listing frame is 936 px wide next to the 272 px filter column so it ends where the header ends", () => {
    expect(read("src/components/new/listing-spec.css")).toContain(".tkn-ls-main { min-width: 0; max-width: 936px; }");
    expect(read("src/components/new/listing-grid.css")).toContain('[data-card-width="medium"] .tkn-ls-main { max-width: 936px; }');
  });

  it("the phone chat button is 48 px and the page leaves 72 px at the bottom", () => {
    expect(read("src/components/chat/SupportChat.tsx")).toContain(".tkn-float .tkn-chat-bubble { width: 48px; height: 48px; } body { padding-bottom: 72px; }");
  });
});
