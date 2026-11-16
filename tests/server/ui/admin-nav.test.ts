import { describe, expect, it } from "vitest";
import { NAV_GROUPS, visibleGroups } from "@/components/admin/nav";
import { csvField, toCsv } from "@/components/admin/ui/DataTable";
import { reorder } from "@/components/admin/ui/SortableList";
import { counterTone } from "@/components/admin/ui/TextField";
import { truncateToWidth } from "@/components/admin/ui/SerpPreview";

function labels(roles: string[]) {
  return visibleGroups(roles).flatMap((group) => group.items.map((entry) => entry.label));
}

describe("admin sidebar by role", () => {
  it("shows support the Dashboard, History, the Support desk, All ads and Users", () => {
    expect(labels(["support"])).toEqual(["Dashboard", "History & undo", "Support desk", "All ads", "Users"]);
    expect(labels(["admin"])).toContain("Users");
    expect(labels(["seo_editor"])).not.toContain("Users");
  });

  it("shows superadmin every screen", () => {
    const all = NAV_GROUPS.flatMap((group) => group.items.map((entry) => entry.label));
    expect(labels(["superadmin"])).toEqual(all);
  });

  it("shows admin everything except the superadmin-only screens", () => {
    const seen = labels(["admin"]);
    expect(seen).toContain("Page builder");
    expect(seen).toContain("Prices & plans");
    expect(seen).not.toContain("Team & roles");
    expect(seen).not.toContain("Settings");
  });

  it("shows seo_editor the SEO screen", () => {
    expect(labels(["seo_editor"])).toContain("SEO");
  });

  it("hides every group from a viewer with no staff role", () => {
    expect(visibleGroups([])).toEqual([]);
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
