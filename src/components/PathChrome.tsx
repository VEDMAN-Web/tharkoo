"use client";

import { usePathname } from "next/navigation";
import { JsonLd } from "@/lib/jsonld";
import { canonical } from "@/lib/seo";
import { safeHref } from "@/lib/sanitize";
import type { SiteContent } from "@/lib/ui/site-content";
import type { UrlPaths } from "@/lib/urls";
import { AgeGate } from "./AgeGate";
import { CityProvider } from "./CityContext";
import { CookieBanner } from "./CookieBanner";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { MainInner } from "./MainInner";
import { UrlPathProvider } from "./UrlPaths";

type City = { slug: string; name: string; stateSlug?: string };
type Cat = { slug: string; name: string };
type NavLink = { label: string; href: string };

/** The part of the site shell the chrome renders. SiteShell (server) prepares it so the page only carries these fields. */
export type ChromeData = {
  site: {
    name?: string;
    tagline?: string;
    legalName?: string;
    countryName?: string;
    supportHours?: string;
    logoText?: string;
  };
  content: Pick<SiteContent, "hero" | "header" | "socials" | "support" | "footer" | "age" | "cookies">;
  footerLinks: NavLink[];
  socialLinks: NavLink[];
  categories: Cat[];
  cities: City[];
  cityCount: number;
  user: { email: string; roles: string[] } | null;
};

export function PathChrome({ shell, paths, children }: { shell: ChromeData; paths: UrlPaths; children: React.ReactNode }) {
  const path = usePathname() || "/";
  if (path.startsWith("/admin") || path.startsWith("/styleguide/admin")) {
    return (
      <UrlPathProvider paths={paths}>
        <div className="min-h-screen bg-bg text-text">
          <main id="main">{children}</main>
        </div>
      </UrlPathProvider>
    );
  }
  const { site, categories, cities, cityCount, user, content, footerLinks, socialLinks } = shell;
  // Style guides are tool pages: no age gate and no cookie banner.
  const toolPage = path.startsWith("/styleguide");
  return (
    <UrlPathProvider paths={paths}>
    <CityProvider cities={cities}>
      {path.startsWith(`/${paths.ad.replace(/^\/|\/$/g, "")}/`) ? null : (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: path === "/" ? site.name || "Tharkoo" : path,
            url: canonical(path),
            isPartOf: { "@type": "WebSite", name: site.name || "Tharkoo", url: canonical("/") },
          }}
        />
      )}
      <Header
        siteName={site.logoText || site.name || "Tharkoo"}
        countryName={site.countryName || "India"}
        searchPlaceholder={content.hero.searchPlaceholder}
        postCta={content.header.postLabel}
        categories={categories}
        cities={cities}
        user={user}
        social={content.socials.length ? content.socials : socialLinks}
        chrome={content.header}
      />
      <MainInner>{children}</MainInner>
      <div
        id="tk-facts"
        hidden
        data-hours={content.support.hours || site.supportHours || "Monday through Friday"}
        data-wa={content.support.whatsapp || ""}
        data-tg={content.support.telegram || ""}
      />
      <Footer
        siteName={site.name || "Tharkoo"}
        legalName={site.legalName || "Tharkoo"}
        cityCount={cityCount}
        about={site.tagline || ""}
        categories={categories}
        links={footerLinks}
        social={content.socials.length ? content.socials : socialLinks}
        content={content.footer}
      />
      {toolPage ? null : (
      <AgeGate
        brand="Tharkoo"
        title={content.age.title}
        lead={content.age.lead}
        rest={content.age.rest}
        terms={content.age.terms}
        yes={content.age.yes}
        no={content.age.no}
        noHref={safeHref(content.age.noHref) || "https://www.google.com"}
      />
      )}
      {toolPage ? null : (
      <CookieBanner
        body={content.cookies.body}
        accept={content.cookies.accept}
        necessary={content.cookies.necessary}
        notice={content.cookies.notice}
        noticeHref={safeHref(content.cookies.noticeHref) || "/cookies/"}
      />
      )}
    </CityProvider>
    </UrlPathProvider>
  );
}
