import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { POST_COPY_DEFAULTS } from "@/components/post/copy";
import { newStepCopy, newSuccessCopy } from "@/components/post/newCopy";
import { isTextKey, makeT, TEXT_DEFAULTS } from "@/lib/ui/text";

const FILES = [
  "src/components/post/PhotoStep.tsx",
  "src/components/post/ContactFields.tsx",
  "src/components/post/ReviewStep.tsx",
  "src/components/post/PostSuccess.tsx",
  "src/components/post/AboutYou.tsx",
  "src/components/post/FormFields.tsx",
  "src/components/post/MediaTile.tsx",
  "src/components/post/PostPreview.tsx",
  "src/components/post/newCopy.ts",
];

const VISIBLE_ATTRS = new Set(["aria-label", "placeholder", "title", "alt", "label", "note", "help", "text", "description", "progressLabel", "summary"]);
const CODE_STRINGS = new Set(["use client", "PATCH", "PUBLISH", "Your ads"]);

function problems(path: string): string[] {
  const text = readFileSync(join(process.cwd(), path), "utf8");
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const where = (node: ts.Node) => `${path}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isJsxText(node)) {
      const words = node.text.replace(/\s+/g, " ").trim();
      if (/[A-Za-z]{2,}/.test(words)) found.push(`${where(node)} text "${words}"`);
    } else if (ts.isJsxAttribute(node) && VISIBLE_ATTRS.has(node.name.getText(sf)) && node.initializer && ts.isStringLiteral(node.initializer)) {
      if (/[A-Za-z]{2,}/.test(node.initializer.text)) found.push(`${where(node)} attribute ${node.name.getText(sf)}="${node.initializer.text}"`);
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent;
      const code =
        ts.isJsxAttribute(parent) ||
        (ts.isPropertyAssignment(parent) && parent.name === node) ||
        ts.isBinaryExpression(parent) ||
        ts.isCaseClause(parent) ||
        ts.isLiteralTypeNode(parent) ||
        ts.isElementAccessExpression(parent) ||
        (ts.isCallExpression(parent) && ["t", "fetch", "api"].includes(parent.expression.getText(sf)));
      const value = node.text;
      if (!code && /[A-Za-z]{3,}/.test(value) && (/\s/.test(value) || /^[A-Z]/.test(value)) && !CODE_STRINGS.has(value) && !/^(\/|https?:|tk|t-)/.test(value)) found.push(`${where(node)} string "${value}"`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe("the post-ad words of H8.38 are UI text keys", () => {
  for (const path of FILES) {
    it(`${path} keeps no visible words in code`, () => {
      expect(problems(path)).toEqual([]);
    });
  }

  it("every key the files use exists", () => {
    const used = new Set<string>();
    for (const path of FILES) for (const match of readFileSync(join(process.cwd(), path), "utf8").matchAll(/"(post\.[A-Za-z0-9.]+)"/g)) used.add(match[1]);
    expect(used.size).toBeGreaterThan(80);
    for (const key of used) expect(isTextKey(key), key).toBe(true);
  });

  it("the built-in words are the ones people saw before", () => {
    const t = makeT();
    expect(t("post.photo.count", { shown: 3, limit: 10 })).toBe("3 of 10 photos and videos");
    expect(t("post.photo.roomOne", { limit: 10 })).toBe("Only 1 more item fits within your limit of 10 photos and videos.");
    expect(t("post.photo.roomMany", { room: 2, limit: 10 })).toBe("Only 2 more items fit within your limit of 10 photos and videos.");
    expect(t("post.photo.photosSaved", { count: 3 })).toBe("3 photos saved.");
    expect(t("post.photo.photoN", { number: 2 })).toBe("Photo 2");
    expect(t("post.tile.progress", { percent: 40 })).toBe("Uploading 40%");
    expect(t("post.tile.moveLeft", { label: "Photo 2" })).toBe("Move Photo 2 left");
    expect(t("post.contactBox.accountEmail", { email: "a***@b.com" })).toBe("We will use your account email: a***@b.com");
    expect(t("post.reviewStep.editAria", { label: "title" })).toBe("Edit title");
    expect(t("post.success.foundOn", { where: "Delhi Flats" })).toBe("People can find it on the Delhi Flats page now.");
    expect(t("post.success.getPlan", { name: "Boost" })).toBe("Get Boost");
    expect(TEXT_DEFAULTS["post.stepCopy.publishAd"]).toBe("Publish ad");
    expect(TEXT_DEFAULTS["post.stepCopy.reviewTitle"]).toBe("Review and publish");
  });

  it("an admin override replaces a word on the page", () => {
    const t = makeT({ "post.photo.addPhotos": "Choose pictures", "post.tile.cover": "Main" });
    expect(t("post.photo.addPhotos")).toBe("Choose pictures");
    expect(t("post.tile.cover")).toBe("Main");
    expect(makeT()("post.photo.addPhotos")).toBe("Add photos");
  });
});

describe("the step wording shows what an admin saved", () => {
  const withStep = (key: "contact" | "review" | "basics", patch: Partial<(typeof POST_COPY_DEFAULTS.steps)["contact"]>) => ({
    ...POST_COPY_DEFAULTS,
    steps: { ...POST_COPY_DEFAULTS.steps, [key]: { ...POST_COPY_DEFAULTS.steps[key], ...patch } },
  });

  it("an untouched step takes the form's own wording from the site texts", () => {
    expect(newStepCopy("review", POST_COPY_DEFAULTS, false).title).toBe("Review and publish");
    expect(newStepCopy("review", POST_COPY_DEFAULTS, false, false, 0, false, "both", makeT({ "post.stepCopy.reviewTitle": "Last look" })).title).toBe("Last look");
    expect(newStepCopy("contact", POST_COPY_DEFAULTS, true, false, 0, false, "both", makeT({ "post.v2.about.title": "Who you are" })).title).toBe("Who you are");
    expect(newStepCopy("contact", POST_COPY_DEFAULTS, false, false, 0, false, "email").help).toBe("People will write to you by email. No phone number is needed.");
  });

  it("a title equal to the stock wording is shown as saved once anything else on the step was changed", () => {
    expect(newStepCopy("contact", withStep("contact", { help: "Tell us how." }), true).title).toBe("Your contacts");
    expect(newStepCopy("review", withStep("review", { backLabel: "Go back" }), false).title).toBe("Publish");
  });

  it("a saved title that is not the stock wording is kept", () => {
    expect(newStepCopy("review", withStep("review", { title: "Final look" }), false).title).toBe("Final look");
    expect(newStepCopy("contact", withStep("contact", { title: "Reach you" }), true).title).toBe("Reach you");
  });

  it("the first step line no longer carries the price (H21.1); an admin-written line is kept", () => {
    expect(newStepCopy("category", POST_COPY_DEFAULTS, false, false, 30).help).toBe("Pick a category. It helps the right people find your ad.");
    expect(newStepCopy("category", withStep("basics", { help: "Choose well." }), false, false, 30).help).toBe("Choose well.");
    expect(newStepCopy("category", POST_COPY_DEFAULTS, false, false, 30, false, "both", makeT({ "post.stepCopy.basicsHelpFee": "It costs {fee} credits to post." })).help).toBe("Pick a category. It helps the right people find your ad."); // H21.1: the price moved to the note under the tiles
  });

  it("the success wording comes from the site texts", () => {
    const own = makeT({ "post.stepCopy.savedTitle": "Done", "post.stepCopy.inReview": "We are checking it" });
    expect(newSuccessCopy(POST_COPY_DEFAULTS, true, true, own).title).toBe("Done");
    expect(newSuccessCopy(POST_COPY_DEFAULTS, false, false, own).title).toBe("We are checking it");
    // H14.2: no View my ads button on the success screen any more; only Post another ad.
    expect(newSuccessCopy(POST_COPY_DEFAULTS, true)).not.toHaveProperty("primary");
  });
});
