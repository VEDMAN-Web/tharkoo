import { describe, expect, it } from "vitest";
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_TELEGRAM, mailtoHref, phoneDigits, telHref, telegramHref, whatsappHref } from "@/lib/support";
import { TEXT_DEFAULTS } from "@/lib/ui/text";

describe("support links", () => {
  it("builds the call link with the plus sign and digits only", () => {
    expect(telHref("+91 912345678")).toBe("tel:+91912345678");
    expect(telHref("(022) 1234-5678")).toBe("tel:02212345678");
    expect(telHref("12")).toBe("");
  });

  it("builds the WhatsApp link from digits only", () => {
    expect(whatsappHref("+91 912345678")).toBe("https://wa.me/91912345678");
    expect(whatsappHref("https://wa.me/91912345678")).toBe("https://wa.me/91912345678");
    expect(whatsappHref("")).toBe("");
    expect(phoneDigits("+91 (912) 345-678")).toBe("91912345678");
  });

  it("builds the Telegram link from a username, an at-name or a t.me link", () => {
    expect(telegramHref("@tharkoo_support")).toBe("https://t.me/tharkoo_support");
    expect(telegramHref("tharkoo_support")).toBe("https://t.me/tharkoo_support");
    expect(telegramHref("https://t.me/tharkoo_support")).toBe("https://t.me/tharkoo_support");
    expect(telegramHref("")).toBe("");
  });

  it("uses the one support setting for the top bar default and the contact defaults", () => {
    expect(TEXT_DEFAULTS["home.utility.phone"]).toBe(SUPPORT_PHONE);
    expect(telHref(SUPPORT_PHONE)).toBe("tel:+91912345678");
    expect(whatsappHref(SUPPORT_PHONE)).toBe("https://wa.me/91912345678");
    expect(telegramHref(SUPPORT_TELEGRAM)).toBe("https://t.me/tharkoo_support");
  });

  it("builds the mailto link from the support email and rejects text that is not an address", () => {
    expect(mailtoHref(SUPPORT_EMAIL)).toBe("mailto:support@tharkoo.com");
    expect(mailtoHref("[YOUR SUPPORT EMAIL]")).toBe("");
    expect(mailtoHref("")).toBe("");
  });

  it("keeps the corrected top bar words and no placeholder text", () => {
    expect(TEXT_DEFAULTS["home.utility.live"]).toBe("Sellers online now");
    expect(TEXT_DEFAULTS["home.utility.verified"]).toBe("Photo verified badges");
    expect(TEXT_DEFAULTS["home.utility.ticker1"]).toBe("Chat with sellers for free");
    expect(TEXT_DEFAULTS["home.utility.ticker2"]).toBe("Fresh ads, live for 72 hours");
    expect(Object.values(TEXT_DEFAULTS).join(" ")).not.toMatch(/\[YOUR (PHONE|WHATSAPP|TELEGRAM)/);
  });
});
