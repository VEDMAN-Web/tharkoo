import { readPaths } from "@/lib/urls";
import { getCategories, getCities, getSite } from "@/lib/queries";
import { plain } from "@/lib/plain";
import { safeHref } from "@/lib/sanitize";
import { textOverrides } from "@/app/admin/ui-text/store";
import { readContent } from "@/lib/ui/site-content";
import { siteLogos } from "@/lib/brand";
import { pickTexts } from "@/lib/ui/text";
import { newDesignOn } from "@/server/site-links/new-design";
import { smsDeliverable } from "@/server/auth/otp";
import { countryChoices } from "@/server/locations/site-country";
import { readShellConfig } from "@/server/site-links/shell-config";
import { normaliseShellConfig, type ShellConfig, type ShellLink } from "@/server/site-links/shell-config-rules";
import { MotionInit } from "./ui/MotionInit";
import { SUPPORT_PHONE, SUPPORT_TELEGRAM, telegramHref, whatsappHref } from "@/lib/support";
import { PathChrome, type ChromeData } from "./PathChrome";

export async function loadShell() {
  const [site, categories, cities, newDesign, shell, countries, texts] = await Promise.all([getSite(), getCategories(), getCities(), newDesignOn(), readShellConfig(), countryChoices(), textOverrides()]);
  return { site, categories, cities, countries, user: null as { email: string; roles: string[] } | null, newDesign, shell, texts };
}

type Shell = Awaited<ReturnType<typeof loadShell>>;
type NavLink = { label: string; href: string };

function navLinks(value: unknown): NavLink[] {
  return (Array.isArray(value) ? value : [])
    .filter((item): item is { label: string; href: string } => Boolean(item && typeof item === "object" && "href" in item && "label" in item))
    .map((item) => ({ label: String(item.label), href: safeHref(String(item.href)) }))
    .filter((item) => item.href);
}

/**
 * Only the fields the client chrome renders are passed on. Passing the whole shell put every category,
 * city and home-page block into the HTML of every page, and the browser had to parse all of it.
 */
type SiteFields = {
  name?: string;
  tagline?: string;
  legalName?: string;
  countryName?: string;
  supportHours?: string;
  logoText?: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  homepage?: unknown;
  footerLinks?: unknown;
  socialLinks?: unknown;
};

/**
 * H7.1: the new shell's text. Where the new config is empty, the old site content still fills the gap
 * (support chat numbers, social links), so nothing a visitor saw before disappears.
 */
function shellWithFallbacks(config: ShellConfig, legacy: { whatsapp: string; telegram: string; socials: ShellLink[] }): ShellConfig {
  return {
    ...config,
    chat: {
      ...config.chat,
      whatsapp: config.chat.whatsapp || legacy.whatsapp,
      telegram: config.chat.telegram || legacy.telegram,
      phone: config.chat.phone || SUPPORT_PHONE,
    },
    footer: {
      ...config.footer,
      socials: config.footer.socials.length ? config.footer.socials : legacy.socials,
    },
  };
}

function chromeData(shell: Shell, signIn: ChromeData["signIn"]): ChromeData {
  const site = shell.site as SiteFields;
  const { categories, cities, countries, user } = shell;
  const { hero, header, socials, support, footer, age, cookies } = readContent(site.homepage);
  const legacySocials: ShellLink[] = (socials.length ? socials : navLinks(site.socialLinks)).map((item) => ({
    label: item.label,
    href: item.href,
    visible: (item as { visible?: boolean }).visible !== false,
    icon: "tag",
  }));
  return {
    site: {
      name: site.name,
      tagline: site.tagline,
      legalName: site.legalName,
      countryName: site.countryName,
      supportHours: site.supportHours,
      logoText: site.logoText,
      logos: siteLogos(site),
    },
    content: { hero, header, socials, support, footer, age, cookies },
    footerLinks: plain(navLinks(site.footerLinks)),
    socialLinks: plain(legacySocials.map((item) => ({ label: item.label, href: item.href }))),
    categories: plain(categories.map((c) => ({ slug: c.slug || "", name: c.name || "" }))),
    cities: plain(cities.map((c) => ({ slug: c.slug || "", name: c.name || "", stateSlug: c.stateSlug }))),
    cityCount: cities.length,
    countries: plain(countries),
    user,
    newDesign: shell.newDesign,
    // H7.8: the header and live chat words from the UI-text store (only those keys reach the client).
    texts: pickTexts(shell.texts, "header.", "chrome.", "chat.", "help.", "home.utility.", "panel."),
    signIn,
    shell: plain(
      shellWithFallbacks(normaliseShellConfig(shell.shell), {
        whatsapp: whatsappHref(support.whatsapp || "") || whatsappHref(SUPPORT_PHONE),
        telegram: telegramHref(support.telegram || "") || telegramHref(SUPPORT_TELEGRAM),
        socials: plain(legacySocials),
      }),
    ),
  };
}

export async function SiteShell({
  children,
  shell,
}: {
  children: React.ReactNode;
  shell: Shell;
  pathname?: string;
  admin?: boolean;
}) {
  const paths = readPaths((shell.site as { paths?: unknown } | null)?.paths);
  const login = readContent((shell.site as { homepage?: unknown } | null)?.homepage);
  const signIn = { showMobile: smsDeliverable(), image: login.loginImage, imageFocus: `${login.loginImageFocusX}% ${login.loginImageFocusY}%` };
  return (
    <>
      <PathChrome shell={chromeData(shell, signIn)} paths={paths}>{children}</PathChrome>
      <MotionInit />
    </>
  );
}
