import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LegalDoc } from "@/components/new/LegalDoc";
import { legalNodes } from "@/components/new/legal-markdown";
import { PRIVACY_EFFECTIVE, PRIVACY_MD, TERMS_EFFECTIVE, TERMS_MD } from "@/content/legal-text";
import { TRUST } from "@/content/trust";
import { BRACKET_PLACEHOLDER } from "@/lib/content/placeholder";
import { areaOf } from "@/lib/ui/text-labels";
import { TEXT_DEFAULTS, makeT } from "@/lib/ui/text";
import { DASH_CHARS } from "@/server/content/dashes";
import { checkFields } from "@/server/content/studio/fields";
import { defaultShellConfig } from "@/server/site-links/shell-config-rules";

/** H17.14a: Terms and Privacy show the approved text, with an effective date from Site text; the footer has the three legal links; no stand-in WhatsApp or Telegram. */

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
const html = (key: "terms" | "privacy") => renderToStaticMarkup(createElement(LegalDoc, { blocks: TRUST[key]!.paragraphs, tableLabel: "What personal data we collect and why" }));

describe("the Terms page text", () => {
  it("is the approved Terms: its sections and its own sentences", () => {
    const text = TRUST.terms!.paragraphs.join("\n");
    for (const lead of ["**1. Who we are.**", "**6. Prohibited content and conduct.**", "**10. Credits and paid features.**", "**17. General.**"]) expect(text).toContain(lead);
    expect(text).toContain("Your first 3 ads are free; after that the price is shown before you publish.");
    expect(text).toContain("Tharkoo is restricted to adults.");
    expect(TRUST.terms!.title).toBe("Terms and Conditions");
  });

  it("no longer carries the old Terms wording", () => {
    const text = TRUST.terms!.paragraphs.join("\n");
    for (const old of ["A free weekly limit applies", "Tharkoo is a classifieds board for people in India", "Status of these terms"]) expect(text).not.toContain(old);
  });

  it("draws 17 sections, the ban list as a numbered list of 10 and the first list as bullets", () => {
    const nodes = legalNodes(TRUST.terms!.paragraphs);
    const sections = nodes.filter((node) => node.kind === "p" && node.parts[0]?.strong && /^\d+\. /.test(node.parts[0].text));
    expect(sections).toHaveLength(17);
    const lists = nodes.filter((node) => node.kind === "ol" || node.kind === "ul");
    expect(lists.map((node) => node.kind)).toEqual(["ul", "ol"]);
    expect(lists.map((node) => (node.kind === "ul" || node.kind === "ol" ? node.items.length : 0))).toEqual([4, 10]);
  });
});

describe("the Privacy page text", () => {
  it("is the approved Privacy Policy with its table of 7 rows and its headings", () => {
    const nodes = legalNodes(TRUST.privacy!.paragraphs);
    const headings = nodes.filter((node) => node.kind === "h2").map((node) => (node.kind === "h2" ? node.text : ""));
    expect(headings).toEqual(["1. What we collect", "3. Who sees your data"]);
    const table = nodes.find((node) => node.kind === "table");
    expect(table && table.kind === "table" ? table.rows.length : 0).toBe(7);
    expect(TRUST.privacy!.title).toBe("Privacy Policy");
    expect(TRUST.privacy!.paragraphs.join("\n")).toContain("Choose \"Only necessary\" to say no");
  });

  it("is drawn with a table in a box of its own that can scroll, and real list and heading elements", () => {
    const page = html("privacy");
    expect(page).toContain('class="tkl-scroll"');
    expect(page).toContain("<table");
    expect(page).toContain("<h2");
    expect(page).toContain("<ul");
    expect(page).toContain("<strong>2. Analytics and cookies.</strong>");
    expect(page).not.toContain("**");
    expect(html("terms")).not.toContain("**");
  });
});

describe("the effective date is a field on the Site text screen", () => {
  it("has a default for each page and an area with a plain name", () => {
    expect(TEXT_DEFAULTS["legal.terms.effective"]).toBe(TERMS_EFFECTIVE);
    expect(TEXT_DEFAULTS["legal.privacy.effective"]).toBe(PRIVACY_EFFECTIVE);
    expect(TERMS_EFFECTIVE).toBe("19 November 2026");
    expect(areaOf("legal.terms.effective").label).toBe("Terms and Privacy");
  });

  it("an admin change reaches the page: the page reads the key", () => {
    expect(makeT({ "legal.terms.effective": "1 January 2027" })("legal.terms.effective")).toBe("1 January 2027");
    expect(read("src/components/new/TrustLegalPage.tsx")).toContain("textOverrides");
    expect(read("src/components/new/TrustLegalPage.tsx")).toContain("Effective date");
  });
});

describe("the approved text keeps its own price message", () => {
  it("says the first 3 ads are free and nothing says posting is free without that condition", () => {
    expect(TERMS_MD).toContain("Your first 3 ads are free");
    expect(`${TERMS_MD}\n${PRIVACY_MD}`).not.toMatch(/free to post|posting is free|free weekly/i);
  });
});

describe("the footer", () => {
  it("has words for Terms, Privacy and Grievance Officer as site text, and the component reads them", () => {
    expect(TEXT_DEFAULTS["chrome.footer.terms"]).toBe("Terms and Conditions");
    expect(TEXT_DEFAULTS["chrome.footer.privacy"]).toBe("Privacy Policy");
    expect(TEXT_DEFAULTS["chrome.footer.grievance"]).toBe("Grievance Officer");
    const footer = read("src/components/FooterNew.tsx");
    for (const key of ["chrome.footer.terms", "chrome.footer.privacy", "chrome.footer.grievance"]) expect(footer).toContain(`"${key}"`);
    expect(footer).toContain('"/grievance/"');
  });

  it("never draws a WhatsApp or Telegram stand-in: no code number or handle in the component", () => {
    const footer = read("src/components/FooterNew.tsx");
    expect(footer).not.toContain("SUPPORT_PHONE");
    expect(footer).not.toContain("SUPPORT_TELEGRAM");
    expect(footer).toContain("if (!value) return null;");
  });

  it("the default footer text and pills do not promise free posting without the first-3-ads condition", () => {
    const footer = defaultShellConfig().footer;
    const words = [footer.about, ...footer.trust].join(" ");
    expect(words).not.toMatch(/free to post|post free|free ads|free classifieds|posting is free/i);
  });
});

describe("the placeholder guard", () => {
  it("matches a bracketed capitalised placeholder", () => {
    for (const text of ["[COMPANY NAME]", "Operated by [Company Name] in [State].", "[Registered Address]", "[Date]"]) expect(BRACKET_PLACEHOLDER.test(text), text).toBe(true);
  });

  it("does not match ordinary brackets, numbers or lower case notes", () => {
    for (const text of ["see note [1]", "the [optional] step", "an array like [a, b]", "Rule 3(1)(b) of India's IT Rules, 2021"]) expect(BRACKET_PLACEHOLDER.test(text), text).toBe(false);
  });

  it("the admin save check (dashes) accepts every block of both approved texts", () => {
    for (const block of [...TRUST.terms!.paragraphs, ...TRUST.privacy!.paragraphs]) {
      expect(DASH_CHARS.test(block), block.slice(0, 40)).toBe(false);
    }
  });

  it("does not block either approved text", () => {
    expect(BRACKET_PLACEHOLDER.test(TERMS_MD)).toBe(false);
    expect(BRACKET_PLACEHOLDER.test(PRIVACY_MD)).toBe(false);
  });

  it("a studio save with a bracketed placeholder is refused with a plain message, and the same text without it is saved", () => {
    const body = (text: string) => ({ title: "Terms", body: { v: 1 as const, nodes: [{ t: "p" as const, text }] } });
    expect(() => checkFields(body("Operated by [COMPANY NAME], registered in the US."))).toThrow(/highlighted fields/);
    expect(() => checkFields(body("Operated by a company registered in the United States."))).not.toThrow();
  });
});
