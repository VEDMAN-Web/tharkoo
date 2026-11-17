import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { makeT, TEXT_DEFAULTS, TEXT_KEYS } from "@/lib/ui/text";
import { areaOf, textWhere } from "@/lib/ui/text-labels";

const CHROME = TEXT_KEYS.filter((key) => key.startsWith("chrome."));
const source = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("header and footer words as site text (H8.47 part 2)", () => {
  it("keep exactly the words the components had before", () => {
    expect(CHROME).toHaveLength(21);
    expect(TEXT_DEFAULTS["chrome.account.my"]).toBe("My account");
    expect(TEXT_DEFAULTS["chrome.account.help"]).toBe("Help and support");
    expect(TEXT_DEFAULTS["chrome.account.chats"]).toBe("Chats");
    expect(TEXT_DEFAULTS["chrome.footer.touch"]).toBe("Get in touch");
    expect(TEXT_DEFAULTS["chrome.menu.close"]).toBe("Close menu");
    expect(makeT()("chrome.account.menuFor", { name: "Riya" })).toBe("Account menu for Riya");
  });

  it("appear on the Site text screen under Header and footer, with a place", () => {
    for (const key of CHROME) {
      expect(areaOf(key).label, key).toBe("Header and footer");
      expect(textWhere(key), key).not.toBe(areaOf(key).where);
    }
  });

  it("an admin's change reaches the components: they read the keys, and the shell hands the keys down", () => {
    expect(source("src/components/SiteShell.tsx")).toContain('"chrome."');
    const header = source("src/components/HeaderNew.tsx");
    const footer = source("src/components/FooterNew.tsx");
    const drawer = source("src/components/HeaderDrawer.tsx");
    for (const key of CHROME) expect(header + footer + drawer, key).toContain(`"${key}"`);
    for (const word of ["My account", "Chats", "Get in touch", "Quick links", "Close menu"]) expect(header + footer + drawer, word).not.toMatch(new RegExp(`>${word}<|"${word}"`));
  });
});
