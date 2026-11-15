import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CityProvider } from "@/components/CityContext";
import { FooterNew } from "@/components/FooterNew";
import { HeaderNew } from "@/components/HeaderNew";
import { SupportChat } from "@/components/chat/SupportChat";
import { UrlPathProvider } from "@/components/UrlPaths";
import { DEFAULT_PATHS } from "@/lib/urls";
import { defaultShellConfig, type ShellConfig } from "@/server/site-links/shell-config-rules";

const cities = [
  { slug: "surat", name: "Surat" },
  { slug: "pune", name: "Pune" },
];
const categories = [
  { slug: "dating", name: "Dating" },
  { slug: "wellness", name: "Wellness" },
];

function wrap(node: React.ReactNode) {
  return renderToStaticMarkup(
    createElement(
      UrlPathProvider,
      { paths: DEFAULT_PATHS } as { paths: typeof DEFAULT_PATHS; children: React.ReactNode },
      createElement(CityProvider, { cities } as { cities: typeof cities; children: React.ReactNode }, node),
    ),
  );
}

function header(config: ShellConfig = defaultShellConfig()) {
  return wrap(createElement(HeaderNew, { siteName: "Tharkoo", shell: config, cities, countries: [{ slug: "india", name: "India", flag: "🇮🇳" }], categories }));
}

describe("H7.1 new header", () => {
  it("shows the pill nav, the country pill, Log in and Post your ad, and no saved or heart icon", () => {
    const html = header();
    for (const label of ["Home", "Categories", "Cities", "How it works", "Help", "Log in"]) {
      expect(html).toContain(label);
    }
    // H7.4c: the location pill shows the country (flag and name), not a city.
    expect(html).toContain("tkn-city");
    expect(html).toContain("India");
    // The long label shows on wide screens; the short "Post ad" shows below 420 px (merged in #157). Both are accepted.
    expect(html).toMatch(/Post your ad|Post ad/);
    expect(html).not.toMatch(/saved|favourite|favorite|heart/i);
  });

  it("keeps the burger for the drawer and labels it", () => {
    const html = header();
    expect(html).toContain('aria-label="Open menu"');
    expect(html).toContain("tkn-burger");
  });

  it("leaves out a nav link whose address is unsafe", () => {
    const config = defaultShellConfig();
    config.header.navLinks = [{ label: "Bad", href: "javascript:alert(1)", visible: true, icon: "tag" }, ...config.header.navLinks];
    expect(header(config)).not.toContain("Bad");
  });

  it("uses the editable labels", () => {
    const config = defaultShellConfig();
    config.header.loginLabel = "Sign in now";
    config.header.postLabel = "Place ad";
    const html = header(config);
    expect(html).toContain("Sign in now");
    expect(html).toContain("Place ad");
  });
});

describe("H7.1 new footer", () => {
  it("has quick links, top categories from the catalogue, contact rows and legal pills", () => {
    const config = defaultShellConfig();
    config.footer.contacts = [{ kind: "email", label: "Email", value: "hello@example.com", href: "mailto:hello@example.com", visible: true }];
    const html = wrap(createElement(FooterNew, { siteName: "Tharkoo", shell: config, categories }));
    expect(html).toContain("Quick links");
    expect(html).toContain("Top categories");
    expect(html).toContain("Dating");
    expect(html).toContain("Get in touch");
    expect(html).toContain("hello@example.com");
    expect(html).toContain("Privacy Policy");
    expect(html).toContain("Dating section is for adults 18+ only");
  });

  it("uses the stored top categories when the admin has chosen them", () => {
    const config = defaultShellConfig();
    config.footer.topCategories = [{ label: "Yoga", href: "/wellness/", visible: true, icon: "tag" }];
    const html = wrap(createElement(FooterNew, { siteName: "Tharkoo", shell: config, categories }));
    expect(html).toContain("Yoga");
    expect(html).not.toContain(">Dating<");
  });
});

describe("H7.1 support chat", () => {
  it("is a round bubble, closed by default, with no panel in the markup", () => {
    const html = wrap(createElement(SupportChat, { chat: defaultShellConfig().chat }));
    expect(html).toContain('aria-label="Open live chat"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("tkn-chatbox");
  });
});
