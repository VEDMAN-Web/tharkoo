import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { isTextKey, makeT, TEXT_DEFAULTS } from "@/lib/ui/text";

const FILES = [
  "src/components/PostWizard.tsx",
  "src/components/post/IdCheckFirst.tsx",
  "src/components/post/PayParts.tsx",
  "src/components/post/NewPostParts.tsx",
  "src/components/post/CategoryTiles.tsx",
  "src/components/post/PickGroup.tsx",
];

/** Words a person reads: attributes that show text on the page or to a screen reader. */
const VISIBLE_ATTRS = new Set(["aria-label", "placeholder", "title", "alt", "label", "note", "help", "text", "description", "progressLabel", "summary"]);
/** String literals in the wizard that are code, not words: methods, selectors, the directive, and the "Sign in" prefix the error banner is matched on. */
const CODE_STRINGS = new Set(["use client", "PATCH", "POST", "PUT", "Sign in", "input:not([type=hidden]):not([type=checkbox]), select, textarea", "(max-width: 1023px)"]);

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

describe("the post-ad words of H8.35 are UI text keys", () => {
  for (const path of FILES) {
    it(`${path} keeps no visible words in code`, () => {
      expect(problems(path)).toEqual([]);
    });
  }

  it("every key the files use exists, and the built-in words are the ones people saw before", () => {
    const used = new Set<string>();
    for (const path of FILES) for (const match of readFileSync(join(process.cwd(), path), "utf8").matchAll(/"(post\.[A-Za-z0-9.]+)"/g)) used.add(match[1]);
    expect(used.size).toBeGreaterThan(60);
    for (const key of used) expect(isTextKey(key), key).toBe(true);
    const t = makeT();
    expect(t("post.step.of3", { step: 2, title: "Photos" })).toBe("Step 2 of 3 · Photos");
    expect(t("post.nav.publishFor", { fee: "30 credits" })).toBe("Publish for 30 credits");
    expect(t("post.pick.many", { max: 3, picked: 1 })).toBe("Pick up to 3 · 1 picked");
    expect(t("post.pay.short", { short: 4 })).toBe("You need 4 more credits to publish.");
    expect(TEXT_DEFAULTS["post.nav.publishAd"]).toBe("Publish ad");
    expect(TEXT_DEFAULTS["post.error.signIn"]).toBe("Sign in to save this draft.");
  });

  it("an admin override replaces a word on the page", () => {
    const t = makeT({ "post.tip.title": "Hint", "post.nav.continue": "Next" });
    expect(t("post.tip.title")).toBe("Hint");
    expect(t("post.nav.continue")).toBe("Next");
    expect(makeT()("post.nav.continue")).toBe("Continue");
  });
});
