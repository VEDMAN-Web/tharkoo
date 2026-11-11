import { describe, expect, it } from "vitest";
import { BLOCKS, BLOCK_TYPES, blockDef, typesForPage } from "@/server/layout/blocks";
import { validateBlocks } from "@/server/layout/service";
import { denyTerm } from "@/server/shared/policy";

const none = new Set<string>();

function block(type: string, props: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { type, visible: true, props, ...extra };
}

describe("block registry", () => {
  it("has a schema, defaults and page list for every type", () => {
    for (const type of BLOCK_TYPES) {
      const def = BLOCKS[type];
      expect(def.pages.length).toBeGreaterThan(0);
      const parsed = def.schema.safeParse(def.defaults());
      expect(parsed.success, `${type} defaults must be valid`).toBe(true);
    }
    expect(BLOCK_TYPES).toHaveLength(22);
  });

  it("lists the block types allowed per page", () => {
    expect(typesForPage("home")).toContain("hero");
    expect(typesForPage("listing")).toContain("listingFeed");
    expect(typesForPage("listing")).not.toContain("hero");
    expect(typesForPage("post")).toContain("postStep");
  });

  it("marks listingHeader, listingFeed and postStep as not deletable", () => {
    expect(blockDef("listingHeader")?.deletable).toBe(false);
    expect(blockDef("listingFeed")?.deletable).toBe(false);
    expect(blockDef("postStep")?.deletable).toBe(false);
    expect(blockDef("hero")?.deletable).toBe(true);
    expect(blockDef("nope")).toBeNull();
  });
});

describe("block validation", () => {
  const goodImage = { assetId: "a1", src: "/uploads/site/hero.webp", alt: "A bright living room", width: 800, height: 600 };

  it("accepts a valid hero", () => {
    const out = validateBlocks("home", [block("hero", { heading: "Hello", imageDesktop: goodImage })], none);
    expect(out).toHaveLength(1);
    expect(out[0].id).toMatch(/[0-9a-f-]{36}/);
    expect(out[0].props.heading).toBe("Hello");
  });

  it("rejects an image with missing or too short alt text", () => {
    expect(() => validateBlocks("home", [block("hero", { heading: "Hello", imageDesktop: { ...goodImage, alt: "" } })], none)).toThrow(/alt|3 characters/i);
    expect(() => validateBlocks("home", [block("hero", { heading: "Hello", imageDesktop: { ...goodImage, alt: "ab" } })], none)).toThrow();
    const noAlt: Record<string, unknown> = { ...goodImage };
    delete noAlt.alt;
    expect(() => validateBlocks("home", [block("hero", { heading: "Hello", imageDesktop: noAlt })], none)).toThrow();
  });

  it("rejects alt text over 125 characters", () => {
    expect(() => validateBlocks("home", [block("hero", { heading: "Hello", imageDesktop: { ...goodImage, alt: "x".repeat(126) } })], none)).toThrow();
  });

  it("rejects scripts and event handlers in rich text", () => {
    expect(() => validateBlocks("home", [block("richText", { body: "<p>Hi</p><script>alert(1)</script>" })], none)).toThrow(/scripts|handlers/i);
    expect(() => validateBlocks("home", [block("richText", { body: '<p onclick="x()">Hi</p>' })], none)).toThrow();
    expect(() => validateBlocks("home", [block("richText", { body: "<img src=x onerror=alert(1)>" })], none)).toThrow();
    expect(() => validateBlocks("home", [block("richText", { body: "<p>Safe <strong>text</strong></p>" })], none)).not.toThrow();
  });

  it("rejects javascript: links", () => {
    expect(() => validateBlocks("home", [block("banner", { link: { label: "Go", href: "javascript:alert(1)" } })], none)).toThrow();
    expect(() => validateBlocks("home", [block("banner", { link: { label: "Go", href: "/dating/" } })], none)).not.toThrow();
  });

  it("rejects forbidden terms anywhere in a block", () => {
    const term = denyTerm("esc", "ort");
    expect(() => validateBlocks("home", [block("richText", { body: `<p>${term} service</p>` })], none)).toThrow(/not allowed/i);
    expect(() => validateBlocks("home", [block("richText", { body: "<p>Fine</p>" }, { label: term })], none)).toThrow(/not allowed/i);
  });

  it("rejects a block type that does not belong on the page", () => {
    expect(() => validateBlocks("home", [block("listingFeed", { emptyTitle: "None" })], none)).toThrow(/cannot be used/i);
    expect(() => validateBlocks("home", [block("mystery", {})], none)).toThrow(/unknown type/i);
  });

  it("enforces per-type maximums and the date window order", () => {
    expect(() => validateBlocks("home", [block("hero", { heading: "A" }), block("hero", { heading: "B" })], none)).toThrow(/at most 1/);
    expect(() =>
      validateBlocks("home", [block("richText", { body: "x" }, { startsAt: "2026-12-02T00:00:00Z", endsAt: "2026-12-01T00:00:00Z" })], none),
    ).toThrow(/end date/);
  });

  it("keeps known ids and gives new blocks fresh ids", () => {
    const out = validateBlocks("home", [block("richText", { body: "a" }, { id: "keep-1" }), block("richText", { body: "b" }, { id: "unknown" })], new Set(["keep-1"]));
    expect(out[0].id).toBe("keep-1");
    expect(out[1].id).not.toBe("unknown");
  });

  it("only lets the promote step be hidden", () => {
    const step = (stepKey: string, visible: boolean) => ({ type: "postStep", visible, props: { stepKey, title: "Step" } });
    expect(() => validateBlocks("post", [step("promote", false)], none)).not.toThrow();
    expect(() => validateBlocks("post", [step("basics", false)], none)).toThrow(/promote/);
    expect(() => validateBlocks("post", [step("basics", true), step("basics", true)], none)).toThrow();
  });
});
