"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { JsonLd } from "@/lib/jsonld";
import { canonical } from "@/lib/seo";
import { safeHref } from "@/lib/sanitize";
import type { SiteContent } from "@/lib/ui/site-content";
import { LOGO_DARK_DEFAULT, LOGO_LIGHT_DEFAULT, type SiteLogos } from "@/lib/brand";
import type { UiTextMap } from "@/lib/ui/text";
import type { UrlPaths } from "@/lib/urls";
import type { ShellConfig } from "@/server/site-links/shell-config-rules";
import { AgeGate } from "./AgeGate";
import { CityProvider } from "./CityContext";
import type { CountryOption } from "@/server/locations/country-scope";
import { CookieBanner } from "./CookieBanner";
import { Footer } from "./Footer";
import { FooterNew } from "./FooterNew";
import { Header } from "./Header";
import { HeaderNew } from "./HeaderNew";
import { MainInner } from "./MainInner";
import { UrlPathProvider } from "./UrlPaths";
import { UiTextProvider } from "./help/UiTextProvider";
import { SupportChat } from "./chat/SupportChat";
import { RechargeHost } from "./recharge/RechargeHost";
import { PromoteHost } from "./promote/PromoteHost";
import { SUPPORT_PHONE, SUPPORT_TELEGRAM } from "@/lib/support";
import { SignInPopup } from "./auth/SignInPopup";
import { AccountProvider } from "./account/AccountContext";

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
    logos?: SiteLogos;
  };
  content: Pick<SiteContent, "hero" | "header" | "socials" | "support" | "footer" | "age" | "cookies">;
  footerLinks: NavLink[];
  socialLinks: NavLink[];
  categories: Cat[];
  cities: City[];
  /** H7.4c: the enabled countries, for the header country list. */
  countries: CountryOption[];
  cityCount: number;
  user: { email: string; roles: string[] } | null;
  /** H7.1: the New design switch. Off shows the old header, footer and no chat. */
  newDesign: boolean;
  shell: ShellConfig;
  /** H7.8: the UI-text overrides for the header and the live chat. */
  texts?: UiTextMap;
  signIn: { showMobile: boolean; image: string; imageFocus?: string };
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
  const { site, categories, cities, countries, cityCount, user, content, footerLinks, socialLinks, newDesign, shell: config, texts, signIn } = shell;
  // Style guides are tool pages: no age gate and no cookie banner.
  const toolPage = path.startsWith("/styleguide");
  const siteName = site.logoText || site.name || "Tharkoo";
  const logos = site.logos ?? { light: LOGO_LIGHT_DEFAULT, dark: LOGO_DARK_DEFAULT };
  return (
    <UrlPathProvider paths={paths}>
    <UiTextProvider texts={texts}>
    <CityProvider cities={cities}>
    <AccountProvider>
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
      {newDesign ? (
        <div className="tkn" data-design="new">
          <HeaderNew siteName={siteName} logo={logos.light} shell={config} cities={cities} countries={countries} categories={categories} texts={texts} />
          <MainInner>{children}</MainInner>
          <FooterNew siteName={siteName} logo={logos.light} shell={config} categories={categories} />
          <SupportChat chat={config.chat} texts={texts} hours={content.support.hours || site.supportHours || ""} />
          <Suspense fallback={null}>
            <RechargeHost />
          </Suspense>
          <PromoteHost />
          <SignInPopup showMobile={signIn.showMobile} image={signIn.image} imageFocus={signIn.imageFocus} />
        </div>
      ) : (
        <>
          <Header
            siteName={siteName}
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
            data-hours={content.support.hours || site.supportHours || ""}
            data-wa={content.support.whatsapp || SUPPORT_PHONE}
            data-tg={content.support.telegram || SUPPORT_TELEGRAM}
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
        </>
      )}
      {toolPage ? null : (
      <AgeGate
        brand="Tharkoo"
        title={content.age.title}
        lead={content.age.lead}
        rest={content.age.rest}
        terms={content.age.terms}
        yes={content.age.yes === "ACCEPT" || content.age.yes === "Accept" ? "I am 18 or older, enter" : content.age.yes}
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
    </AccountProvider>
    </CityProvider>
    </UiTextProvider>
    </UrlPathProvider>
  );
}
