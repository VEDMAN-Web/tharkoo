"use client";

import { usePathname } from "next/navigation";
import { JsonLd } from "@/lib/jsonld";
import { canonical } from "@/lib/seo";
import { plain } from "@/lib/plain";
import { safeHref } from "@/lib/sanitize";
import { readContent } from "@/lib/ui/site-content";
import type { UrlPaths } from "@/lib/urls";
import { AgeGate } from "./AgeGate";
import { CityProvider } from "./CityContext";
import { CookieBanner } from "./CookieBanner";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { MainInner } from "./MainInner";
import { UrlPathProvider } from "./UrlPaths";

type City = { slug?: string; name?: string; stateSlug?: string; isTop?: boolean };
type Cat = { slug?: string; name?: string };
type Shell = {
  site: {
    name?: string;
    tagline?: string;
    legalName?: string;
    countryName?: string;
    supportHours?: string;
    supportWhatsapp?: string;
    supportTelegram?: string;
    logoText?: string;
    homepage?: unknown;
    footerLinks?: unknown;
    socialLinks?: unknown;
  };
  categories: Cat[];
  topCities: City[];
  cities: City[];
  user: { email: string; roles: string[] } | null;
};

export function PathChrome({ shell, paths, children }: { shell: Shell; paths: UrlPaths; children: React.ReactNode }) {
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
  const { site, categories, topCities, cities, user } = shell;
  // Style guides are tool pages: no age gate and no cookie banner.
  const toolPage = path.startsWith("/styleguide");
  const content = readContent(site.homepage);
  const catProps = plain(categories.map((c) => ({ slug: c.slug || "", name: c.name || "" })));
  const cityProps = plain(cities.map((c) => ({ slug: c.slug || "", name: c.name || "", stateSlug: c.stateSlug })));
  const asLinks = (value: unknown) =>
    (Array.isArray(value) ? value : [])
      .filter((item): item is { label: string; href: string } => Boolean(item && typeof item === "object" && "href" in item && "label" in item))
      .map((item) => ({ label: String(item.label), href: safeHref(String(item.href)) }))
      .filter((item) => item.href);
  const footerLinks = plain(asLinks(site.footerLinks));
  const socialLinks = plain(asLinks(site.socialLinks));
  return (
    <UrlPathProvider paths={paths}>
    <CityProvider cities={cityProps}>
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
        categories={catProps}
        cities={cityProps}
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
        cityCount={cities.length}
        about={site.tagline || ""}
        categories={catProps}
        cities={plain(topCities.map((c) => ({ slug: c.slug || "", name: c.name || "" })))}
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
