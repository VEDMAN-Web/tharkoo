import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContactView, type ContactInfo } from "@/components/new/ContactView";
import { UtilityStrip } from "@/components/new/UtilityStrip";
import { socialStatus } from "@/server/site-links/social-status";
import { defaultShellConfig } from "@/server/site-links/shell-config-rules";
import { TEXT_DEFAULTS } from "@/lib/ui/text";

/** FIX-21: the code has no stand-in phone number or Telegram name. A row shows only when an admin value is saved. */

const STAND_INS = [/912345678/, /tharkoo_support/, /SUPPORT_PHONE/, /SUPPORT_TELEGRAM/];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

const EMPTY: ContactInfo = { email: "", phone: "", whatsapp: "", telegram: "", hours: "", office: "" };
const SAVED: ContactInfo = { ...EMPTY, email: "help@example.test", phone: "+91 90000 11111", whatsapp: "+91 90000 22222", telegram: "@example_help" };
const contact = (info: ContactInfo) => renderToStaticMarkup(createElement(ContactView, { title: "Contact", info, grievanceHref: "/cms/grievance/", helpHref: "/help/", homeHref: "/" }));

describe("the code has no stand-in number or Telegram name", () => {
  it("no file under src names one", () => {
    const hits: string[] = [];
    for (const file of sourceFiles(join(process.cwd(), "src"))) {
      const text = readFileSync(file, "utf8");
      for (const pattern of STAND_INS) if (pattern.test(text)) hits.push(`${file}: ${pattern}`);
    }
    expect(hits).toEqual([]);
  });

  it("the top strip phone has no default", () => {
    expect(TEXT_DEFAULTS["home.utility.phone"]).toBe("");
  });
});

describe("the Contact page", () => {
  it("shows no WhatsApp, Phone or Telegram card while no value is saved, and keeps Email and Live chat", () => {
    const html = contact(EMPTY);
    for (const card of [">WhatsApp<", ">Phone<", "Open WhatsApp", "Call us", "Telegram"]) expect(html, card).not.toContain(card);
    expect(html).toContain("Live chat");
    expect(html).toContain("Email");
  });

  it("shows the three rows with the saved values", () => {
    const html = contact(SAVED);
    expect(html).toContain(">WhatsApp<");
    expect(html).toContain(">Phone<");
    expect(html).toContain("Open WhatsApp");
    expect(html).toContain("https://wa.me/919000022222");
    expect(html).toContain("Call us");
    expect(html).toContain("tel:+919000011111");
    expect(html).toContain("@example_help");
  });
});

describe("the top strip", () => {
  it("has no phone link while no number is saved, and shows it when one is", () => {
    expect(renderToStaticMarkup(createElement(UtilityStrip, {}))).not.toContain("top-bar-phone");
    const html = renderToStaticMarkup(createElement(UtilityStrip, { texts: { "home.utility.phone": "+91 90000 11111" } }));
    expect(html).toContain("top-bar-phone");
    expect(html).toContain("tel:+919000011111");
  });
});

describe("the social icons status", () => {
  it("WhatsApp and Telegram have no default address, so without a saved link they open nothing", () => {
    const status = socialStatus(defaultShellConfig(), []);
    for (const name of ["WhatsApp", "Telegram"]) expect(status.find((row) => row.name === name)).toMatchObject({ source: "none", href: "" });
  });
});
