import { describe, expect, it } from "vitest";
import { CARD_FOCUS, CARD_SIZES } from "@/lib/layout/cards";
import { BLOCK_META, type Field } from "@/components/admin/layout-editor/fields";
import { validateBlocks } from "@/server/layout/service";

const none = new Set<string>();

function cardsWith(focus: unknown) {
  return validateBlocks(
    "home",
    [
      {
        type: "categoryGrid",
        visible: true,
        props: { title: "Browse", items: [{ categorySlug: "dating", focus }] },
      },
    ],
    none,
  );
}

describe("category card photos (H6.13)", () => {
  it("sizes the photo for the phone column up to 640 px, and the 300 px card above it", () => {
    expect(CARD_SIZES).toBe("(max-width: 640px) 92vw, 300px");
  });

  it("offers the five focal points, with centre as the default", () => {
    expect(CARD_FOCUS).toEqual(["center", "top", "bottom", "left", "right"]);
    const grid = BLOCK_META.categoryGrid.fields.find((field): field is Extract<Field, { kind: "items" }> => field.kind === "items");
    const focus = grid?.fields.find((field) => field.key === "focus");
    expect(focus).toMatchObject({ kind: "select", def: "center" });
    expect(focus && focus.kind === "select" ? focus.options.map(([value]) => value) : []).toEqual(CARD_FOCUS);
  });

  it("keeps a chosen focal point on a card and writes nothing when it is not set", () => {
    const [saved] = cardsWith("top");
    expect((saved.props.items as { focus?: string }[])[0].focus).toBe("top");
    const [plain] = validateBlocks("home", [{ type: "categoryGrid", visible: true, props: { items: [{ categorySlug: "dating" }] } }], none);
    expect((plain.props.items as Record<string, unknown>[])[0]).not.toHaveProperty("focus");
  });

  it("rejects a focal point that is not one of the five", () => {
    expect(() => cardsWith("middle")).toThrow();
  });

  it("explains the best photo size in the editor", () => {
    const grid = BLOCK_META.categoryGrid.fields.find((field): field is Extract<Field, { kind: "items" }> => field.kind === "items");
    const image = grid?.fields.find((field) => field.key === "image");
    expect(image).toMatchObject({ kind: "image", help: "Best size 1080 x 1350 (portrait). Desktop shows the middle part in a wider frame." });
  });
});
