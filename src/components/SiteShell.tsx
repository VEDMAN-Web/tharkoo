import { readPaths } from "@/lib/urls";
import { getCategories, getCities, getSite } from "@/lib/queries";
import { plain } from "@/lib/plain";
import { safeHref } from "@/lib/sanitize";
import { readContent } from "@/lib/ui/site-content";
import { MotionInit } from "./ui/MotionInit";
import { PathChrome, type ChromeData } from "./PathChrome";

export async function loadShell() {
  const [site, categories, cities] = await Promise.all([getSite(), getCategories(), getCities()]);
  return { site, categories, cities, user: null as { email: string; roles: string[] } | null };
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
  homepage?: unknown;
  footerLinks?: unknown;
  socialLinks?: unknown;
};

function chromeData(shell: Shell): ChromeData {
  const site = shell.site as SiteFields;
  const { categories, cities, user } = shell;
  const { hero, header, socials, support, footer, age, cookies } = readContent(site.homepage);
  return {
    site: {
      name: site.name,
      tagline: site.tagline,
      legalName: site.legalName,
      countryName: site.countryName,
      supportHours: site.supportHours,
      logoText: site.logoText,
    },
    content: { hero, header, socials, support, footer, age, cookies },
    footerLinks: plain(navLinks(site.footerLinks)),
    socialLinks: plain(navLinks(site.socialLinks)),
    categories: plain(categories.map((c) => ({ slug: c.slug || "", name: c.name || "" }))),
    cities: plain(cities.map((c) => ({ slug: c.slug || "", name: c.name || "", stateSlug: c.stateSlug }))),
    cityCount: cities.length,
    user,
  };
}

export function SiteShell({
  children,
  shell,
}: {
  children: React.ReactNode;
  shell: Shell;
  pathname?: string;
  admin?: boolean;
}) {
  const paths = readPaths((shell.site as { paths?: unknown } | null)?.paths);
  return (
    <>
      <PathChrome shell={chromeData(shell)} paths={paths}>{children}</PathChrome>
      <MotionInit />
    </>
  );
}
