import { describe, expect, it } from "vitest";
import { defaultShellConfig } from "@/server/site-links/shell-config-rules";
import { SOCIAL_NETWORKS, socialStatus } from "@/server/site-links/social-status";

const config = (socials: { label: string; href: string; visible?: boolean }[]) => {
  const base = defaultShellConfig();
  return { ...base, footer: { ...base.footer, socials: socials.map((item) => ({ icon: "tag" as const, visible: true, ...item })) } };
};

describe("which footer icons are live (H8.54)", () => {
  it("lists the six icons of the footer in its order", () => {
    expect(SOCIAL_NETWORKS.map((item) => item.name)).toEqual(["WhatsApp", "X", "LinkedIn", "Instagram", "Pinterest", "Telegram"]);
    expect(socialStatus(config([]), []).map((item) => item.name)).toEqual(["WhatsApp", "X", "LinkedIn", "Instagram", "Pinterest", "Telegram"]);
  });

  it("with nothing saved, no icon has an address: there is no stand-in WhatsApp or Telegram (FIX-21)", () => {
    const status = socialStatus(config([]), []);
    expect(status.filter((item) => item.source === "default")).toEqual([]);
    expect(status.filter((item) => item.source === "none").map((item) => item.name)).toEqual(["WhatsApp", "X", "LinkedIn", "Instagram", "Pinterest", "Telegram"]);
  });

  it("a visible link whose text is the network name wins, in any letter case, and an unsafe or hidden one does not", () => {
    const status = socialStatus(
      config([
        { label: "instagram", href: "https://instagram.com/tharkoo" },
        { label: "X", href: "javascript:alert(1)" },
        { label: "LinkedIn", href: "https://linkedin.com/company/tharkoo", visible: false },
      ]),
      [],
    );
    expect(status.find((item) => item.name === "Instagram")).toMatchObject({ source: "link", href: "https://instagram.com/tharkoo" });
    expect(status.find((item) => item.name === "X")?.source).toBe("none");
    expect(status.find((item) => item.name === "LinkedIn")?.source).toBe("none");
  });

  it("while no link is saved here the older social links of the site record are used, as the footer does", () => {
    const status = socialStatus(config([]), [{ label: "Pinterest", href: "https://pinterest.com/tharkoo" }]);
    expect(status.find((item) => item.name === "Pinterest")).toMatchObject({ source: "link", href: "https://pinterest.com/tharkoo" });
    const saved = socialStatus(config([{ label: "X", href: "https://x.com/tharkoo" }]), [{ label: "Pinterest", href: "https://pinterest.com/tharkoo" }]);
    expect(saved.find((item) => item.name === "Pinterest")?.source).toBe("none");
  });
});
