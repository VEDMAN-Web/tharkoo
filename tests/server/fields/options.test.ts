import { describe, expect, it } from "vitest";
import { TEXT_DENY_TERMS } from "@/server/shared/policy";
import {
  MAX_OPTION_LENGTH,
  assertRoomFor,
  csvFirstColumn,
  normalizeOption,
  optionKey,
  pasteLines,
  reviewOptionCells,
  unlistedPicks,
} from "@/server/fields/options";

describe("normalizeOption", () => {
  it("trims, collapses spaces and strips tags and control characters", () => {
    expect(normalizeOption("  Ash   brown\u0007 ")).toBe("Ash brown");
    expect(normalizeOption("<b>Auburn</b>")).toBe("Auburn");
  });

  it("returns an empty string for anything that is not text", () => {
    expect(normalizeOption(42)).toBe("");
    expect(normalizeOption(null)).toBe("");
  });
});

describe("optionKey", () => {
  it("compares options without regard to case", () => {
    expect(optionKey("Ash BROWN")).toBe(optionKey("ash brown"));
  });
});

describe("reviewOptionCells", () => {
  it("keeps the pasted order, skips blank lines and counts repeats within the paste", () => {
    const review = reviewOptionCells(["Blonde", "", "  brunette ", "BLONDE", "Black"]);
    expect(review.values).toEqual(["Blonde", "brunette", "Black"]);
    expect(review.duplicates).toBe(1);
    expect(review.rejected).toEqual([]);
  });

  it("rejects a line that is too long, with its line number and no copy of the text", () => {
    const long = "x".repeat(MAX_OPTION_LENGTH + 1);
    const review = reviewOptionCells(["Fine", long]);
    expect(review.values).toEqual(["Fine"]);
    expect(review.rejected).toEqual([{ line: 2, reason: `Longer than ${MAX_OPTION_LENGTH} characters` }]);
    expect(JSON.stringify(review.rejected)).not.toContain("xxxx");
  });

  it("refuses a paste with more lines than the limit", () => {
    const review = reviewOptionCells(["a", "b", "c"], 2);
    expect(review.values).toEqual([]);
    expect(review.rejected[0]).toEqual({ line: 0, reason: "Add at most 2 lines at a time" });
  });

  it("rejects banned wording with a generic reason", () => {
    const banned = TEXT_DENY_TERMS[1].join(" ");
    const review = reviewOptionCells(["Travel", banned]);
    expect(review.values).toEqual(["Travel"]);
    expect(review.rejected).toEqual([{ line: 2, reason: "Not allowed on Tharkoo" }]);
  });
});

describe("pasteLines", () => {
  it("reads Windows and Unix line endings", () => {
    expect(pasteLines("Hindi\r\nEnglish\nTamil")).toEqual(["Hindi", "English", "Tamil"]);
    expect(pasteLines(undefined as unknown as string)).toEqual([]);
  });
});

describe("csvFirstColumn", () => {
  it("reads the first column and drops a header row", () => {
    expect(csvFirstColumn("option,notes\nTravel,x\nMusic,y\n")).toEqual(["Travel", "Music"]);
  });

  it("handles a quoted cell with a comma and an escaped quote", () => {
    expect(csvFirstColumn('"Food, drink",1\n"Say ""hi""",2')).toEqual(["Food, drink", 'Say "hi"']);
  });

  it("strips a byte order mark and keeps a first row that is not a header", () => {
    expect(csvFirstColumn("﻿Hindi\nTamil")).toEqual(["Hindi", "Tamil"]);
  });
});

describe("unlistedPicks", () => {
  it("returns the picks that are not in the admin list", () => {
    expect(unlistedPicks(["Blonde", "Brunette"], ["Blonde", "Purple", 3])).toEqual(["Purple", "3"]);
  });

  it("returns nothing when every pick is listed", () => {
    expect(unlistedPicks(["Blonde"], ["Blonde"])).toEqual([]);
  });
});

describe("assertRoomFor", () => {
  it("allows up to the cap and refuses one more", () => {
    expect(() => assertRoomFor(4999, 1)).not.toThrow();
    expect(() => assertRoomFor(5000, 1)).toThrow(/at most 5000 options/);
  });
});
