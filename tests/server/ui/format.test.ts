import { describe, expect, test } from "vitest";
import { displayTitle } from "@/lib/format";

describe("displayTitle", () => {
  test("strips a long numeric prefix", () => {
    expect(displayTitle("9000000016 - Bangalore Dating: Ravi")).toBe("Bangalore Dating: Ravi");
  });

  test("leaves ordinary titles", () => {
    expect(displayTitle("Weekend photography walk")).toBe("Weekend photography walk");
    expect(displayTitle("12 - short")).toBe("12 - short");
  });
});
