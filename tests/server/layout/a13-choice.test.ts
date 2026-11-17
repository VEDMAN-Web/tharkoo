import { describe, expect, it } from "vitest";
import { chooseHomeSource, type PublishedHome } from "@/lib/layout/home-read";

const block = { id: "b", type: "homeBanner", visible: true, props: {} };
const v1: PublishedHome = { format: 1, blocks: [{ ...block, type: "hero" }] };
const v2: PublishedHome = { format: 2, blocks: [block] };

describe("which home page is shown (A13)", () => {
  it("draws the layout only when New design is on, the switch is on and a format 2 layout is published", () => {
    expect(chooseHomeSource({ newDesign: true, fromLayout: true, published: v2 })).toBe("layout");
  });

  it("keeps today's New design home when the switch is off, whatever is published", () => {
    expect(chooseHomeSource({ newDesign: true, fromLayout: false, published: v2 })).toBe("new");
    expect(chooseHomeSource({ newDesign: true, fromLayout: false, published: v1 })).toBe("new");
    expect(chooseHomeSource({ newDesign: true, fromLayout: false, published: null })).toBe("new");
  });

  it("never draws a format 1 layout with the new path", () => {
    expect(chooseHomeSource({ newDesign: true, fromLayout: true, published: v1 })).toBe("new");
  });

  it("falls back to today's home when the switch is on but nothing usable is published", () => {
    expect(chooseHomeSource({ newDesign: true, fromLayout: true, published: null })).toBe("new");
    expect(chooseHomeSource({ newDesign: true, fromLayout: true, published: { format: 2, blocks: [] } })).toBe("new");
  });

  it("keeps the old design on its own path and never lets it draw a format 2 layout", () => {
    expect(chooseHomeSource({ newDesign: false, fromLayout: true, published: v1 })).toBe("layout-v1");
    expect(chooseHomeSource({ newDesign: false, fromLayout: false, published: v1 })).toBe("layout-v1");
    expect(chooseHomeSource({ newDesign: false, fromLayout: true, published: v2 })).toBe("built-in");
    expect(chooseHomeSource({ newDesign: false, fromLayout: false, published: null })).toBe("built-in");
  });
});
