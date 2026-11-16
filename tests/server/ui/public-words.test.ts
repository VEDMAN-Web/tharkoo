import { describe, expect, it } from "vitest";
import { TEXT_DEFAULTS } from "@/lib/ui/text";
import { defaultShellConfig } from "@/server/site-links/shell-config-rules";
import { HELP_ARTICLES } from "@/data/help";

const BANNED = /\b(sellers?|vendors?|buyers?)\b/i;

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) strings(item, out);
  else if (value && typeof value === "object") for (const item of Object.values(value)) strings(item, out);
  return out;
}

describe("visitor-facing words", () => {
  it("the UI text defaults never say seller, vendor or buyer", () => {
    const hits = Object.entries(TEXT_DEFAULTS).filter(([, value]) => BANNED.test(value));
    expect(hits).toEqual([]);
  });

  it("the shell defaults (header, footer, chat) never say seller, vendor or buyer", () => {
    const hits = strings(defaultShellConfig()).filter((text) => BANNED.test(text));
    expect(hits).toEqual([]);
  });

  it("the help articles never say seller, vendor or buyer", () => {
    const hits = strings(HELP_ARTICLES).filter((text) => BANNED.test(text));
    expect(hits).toEqual([]);
  });
});
