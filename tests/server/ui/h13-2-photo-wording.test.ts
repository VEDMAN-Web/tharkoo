import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { POST_COPY_DEFAULTS } from "@/components/post/copy";
import { makeT } from "@/lib/ui/text";

/** H13.2: photos of any size are accepted since H13.1 part 2 (a big photo is made smaller in the browser), so no photo help promises 8 MB. */

const LINE = "JPG, PNG or WEBP, any size. Big photos are made smaller for you.";

describe("H13.2 the photo step says any size", () => {
  it("the Photos step line, as a default and as a site-text key, is the any-size line", () => {
    expect(POST_COPY_DEFAULTS.photoRules.items).toEqual([LINE]);
    expect(makeT()("post.photo.photoRuleFallback")).toBe(LINE);
  });

  it("no photo help of the seller flow or the staff upload boxes still says 8 MB each", () => {
    for (const file of ["src/components/post/copy.ts", "src/lib/ui/text.ts", "src/components/post/mediaUpload.ts", "src/app/admin/import/ImportForm.tsx", "src/app/admin/media/BatchUpload.tsx"]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/8 MB each/);
    }
  });
});
