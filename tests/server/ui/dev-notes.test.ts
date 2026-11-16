import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ABOUT_BODY, GRIEVANCE_BODY, publishedGuides } from "@/content/editorial";
import { TRUST } from "@/content/trust";
import { bodyParagraphs, hasPlaceholder, publicParagraphs, stripDevNotes } from "@/components/new/legal-copy";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("stripDevNotes", () => {
  it("drops the sentences that are notes to the team and keeps the rest", () => {
    expect(stripDevNotes("These terms are a draft for review. They apply today.")).toBe("They apply today.");
    expect(stripDevNotes("Jobs are busy. They are the busiest demo queries. Use a city URL, not search, if you want the page indexed.")).toBe("Jobs are busy.");
    expect(stripDevNotes("Plain visitor text. Nothing to remove.")).toBe("Plain visitor text. Nothing to remove.");
  });

  it("removes a paragraph that is only a note", () => {
    expect(bodyParagraphs("First.\n\nThis demo uses original placeholder graphics.\n\nLast.")).toEqual(["First.", "Last."]);
    expect(publicParagraphs(["This cookies note is a draft for review."], "cookies")).toEqual([]);
  });
});

describe("public copy in the source", () => {
  it("has no draft or demo notes in the legal pages", () => {
    for (const [key, copy] of Object.entries(TRUST)) {
      for (const paragraph of copy.paragraphs) {
        if (hasPlaceholder(paragraph)) continue;
        expect(stripDevNotes(paragraph), `${key}: ${paragraph.slice(0, 60)}`).toBe(paragraph);
      }
    }
  });

  it("has no notes in the published guides, the about page and the grievance page", () => {
    const published = publishedGuides().filter((item) => item.status === "published");
    expect(published.length).toBeGreaterThan(0);
    for (const body of [...published.map((item) => item.body), ABOUT_BODY, GRIEVANCE_BODY]) {
      expect(stripDevNotes(body)).toBe(body);
    }
  });

  it("never links to the missing /prohibited/ page", () => {
    const hits = sourceFiles("src").filter((file) => /["'`]\/prohibited\/["'`]/.test(readFileSync(file, "utf8")));
    expect(hits).toEqual([]);
  });
});
