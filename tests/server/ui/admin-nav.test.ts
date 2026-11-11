import { describe, expect, it } from "vitest";
import { NAV_GROUPS, canSee, findItem, visibleGroups } from "@/components/admin/nav";
import { csvField, toCsv } from "@/components/admin/ui/DataTable";
import { reorder } from "@/components/admin/ui/SortableList";
import { counterTone } from "@/components/admin/ui/TextField";
import { truncateToWidth } from "@/components/admin/ui/SerpPreview";

function labels(roles: string[]) {
  return visibleGroups(roles).flatMap((group) => group.items.map((entry) => entry.label));
}

describe("admin sidebar by role", () => {
  it("shows support only Dashboard and Users", () => {
    expect(labels(["support"])).toEqual(["Dashboard", "Users"]);
  });

  it("shows superadmin every screen", () => {
    const all = NAV_GROUPS.flatMap((group) => group.items.map((entry) => entry.label));
    expect(labels(["superadmin"])).toEqual(all);
  });

  it("shows admin everything except superadmin-only screens", () => {
    const seen = labels(["admin"]);
    expect(seen).toContain("Home page");
    expect(seen).toContain("Listing order");
    expect(seen).not.toContain("Team & roles");
    expect(seen).not.toContain("Settings");
    expect(seen).not.toContain("Feature flags");
  });

  it("shows seo_editor the whole SEO group", () => {
    const seo = NAV_GROUPS.find((group) => group.id === "seo");
    const seen = visibleGroups(["seo_editor"]).find((group) => group.id === "seo");
    expect(seo?.items.length).toBeGreaterThan(0);
    expect(seen?.items.map((entry) => entry.id)).toEqual(seo?.items.map((entry) => entry.id));
  });

  it("hides every group from a viewer with no staff role", () => {
    expect(visibleGroups([])).toEqual([]);
    expect(canSee([], "support")).toBe(false);
  });

  it("links unbuilt screens to the placeholder page", () => {
    const media = findItem("media");
    expect(media?.task).toBe("H3.3");
    expect(media?.href).toBe("/admin/coming/media/");
  });
});

describe("admin ui helpers", () => {
  it("moves a row without changing the input", () => {
    const input = ["a", "b", "c"];
    expect(reorder(input, 0, 2)).toEqual(["b", "c", "a"]);
    expect(input).toEqual(["a", "b", "c"]);
    expect(reorder(input, 1, 1)).toEqual(input);
    expect(reorder(input, -1, 2)).toEqual(input);
  });

  it("colours the character counter", () => {
    expect(counterTone(0, 30, 60)).toBe("");
    expect(counterTone(10, 30, 60)).toBe("is-short");
    expect(counterTone(45, 30, 60)).toBe("is-ok");
    expect(counterTone(70, 30, 60)).toBe("is-long");
  });

  it("escapes CSV and blocks spreadsheet formulas", () => {
    expect(csvField('He said "hi", ok')).toBe('"He said ""hi"", ok"');
    expect(csvField("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(csvField("-12")).toBe("-12");
    expect(csvField(null)).toBe("");
    expect(toCsv([{ key: "name", label: "Name" }], [{ name: "Asha" }])).toBe("Name\r\nAsha");
  });

  it("cuts text to a pixel width with an ellipsis", () => {
    const measure = (text: string) => text.length * 10;
    expect(truncateToWidth("short", 100, measure)).toBe("short");
    const cut = truncateToWidth("a very long title that does not fit", 100, measure);
    expect(cut.endsWith("…")).toBe(true);
    expect(measure(cut)).toBeLessThanOrEqual(100);
  });
});
