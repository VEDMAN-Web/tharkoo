import { describe, expect, it } from "vitest";
import { doneWords, whenLabel, whoLine } from "@/app/admin/history/_view/format";

const NOW = new Date("2026-06-15T10:00:00.000Z");

describe("History & undo wording (A26)", () => {
  it("writes the time in Indian time: today, yesterday, then the date", () => {
    expect(whenLabel("2026-06-15T09:42:00.000Z", NOW)).toBe("15:12");
    expect(whenLabel("2026-06-14T18:28:00.000Z", NOW)).toBe("Yesterday 23:58");
    expect(whenLabel("2026-06-10T12:50:00.000Z", NOW)).toBe("10 Jun, 18:20");
    expect(whenLabel("2025-12-31T20:00:00.000Z", NOW)).toBe("1 Jan, 01:30");
    expect(whenLabel("2025-03-01T10:00:00.000Z", NOW)).toBe("1 Mar 2025, 15:30");
  });

  it("says what a button did", () => {
    expect(doneWords("Undo")).toBe("Undone.");
    expect(doneWords("Unban")).toBe("User unbanned.");
    expect(doneWords("Redo")).toBe("Done again.");
    expect(doneWords("Restore v13")).toBe("Restored v13.");
  });

  it("adds the role after the name", () => {
    expect(whoLine("Ayesha", "Moderator")).toBe("Ayesha · Moderator");
    expect(whoLine("The system", "")).toBe("The system");
  });
});
