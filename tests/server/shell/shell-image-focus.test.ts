import { describe, expect, it } from "vitest";
import { normaliseShellConfig, shellConfigSchema, defaultShellConfig } from "@/server/site-links/shell-config-rules";
import { photoFocusOf } from "@/components/h714/photo";

const base = defaultShellConfig();

describe("shell image focus points", () => {
  it("keeps focus numbers from 0 to 100 and drops anything else", () => {
    const config = normaliseShellConfig({
      ...base,
      media: {
        images: [
          { scope: "category", slug: "dating", photo: "/uploads/a.jpg", band: "", bandPhone: "", focusX: 30.4, focusY: 150, bandFocusX: "x" },
        ],
      },
    });
    const row = config.media.images[0];
    expect(row.focusX).toBe(30);
    expect(row.focusY).toBe(100);
    expect(row.bandFocusX).toBeUndefined();
  });

  it("is accepted by the save schema", () => {
    const parsed = shellConfigSchema.safeParse({
      ...base,
      media: { images: [{ scope: "city", slug: "surat", photo: "", band: "/uploads/b.jpg", bandPhone: "", bandFocusX: 70, bandFocusY: 20 }] },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.media?.images[0].bandFocusX).toBe(70);
  });

  it("gives card photos 50% 18% unless the admin set a point", () => {
    const shell = {
      ...base,
      media: {
        images: [
          { scope: "category" as const, slug: "dating", photo: "/uploads/a.jpg", band: "", bandPhone: "", focusX: 40, focusY: 10 },
          { scope: "category" as const, slug: "jobs", photo: "/uploads/b.jpg", band: "", bandPhone: "" },
        ],
      },
    };
    expect(photoFocusOf(shell, "category", "dating")).toBe("40% 10%");
    expect(photoFocusOf(shell, "category", "jobs")).toBe("50% 18%");
    expect(photoFocusOf(shell, "category", "missing")).toBe("50% 18%");
  });
});
