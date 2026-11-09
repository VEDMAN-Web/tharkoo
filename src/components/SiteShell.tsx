import { AgeGate } from "./AgeGate";
import { CookieBanner } from "./CookieBanner";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { MainInner } from "./MainInner";
import { getCategories, getCities, getSite, getTopCities } from "@/lib/queries";
import { plain } from "@/lib/plain";
import { safeCssColor, safeHref } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

export async function SiteShell({ children }: { children: React.ReactNode }) {
  const [site, categories, topCities, cities] = await Promise.all([
    getSite(),
    getCategories(),
    getTopCities(),
    getCities(),
  ]);
  const catProps = plain(categories.map((c) => ({ slug: c.slug!, name: c.name! })));
  const theme = plain((site as { theme?: Record<string, string> }).theme || {});
  const css = Object.entries({
    "--sk-pink": safeCssColor(theme.accent),
    "--sk-blue": safeCssColor(theme.primary),
    "--sk-page": safeCssColor(theme.page),
    "--sk-top": safeCssColor(theme.top),
    "--sk-link": safeCssColor(theme.link),
    "--brand-primary": safeCssColor(theme.primary),
    "--brand-accent": safeCssColor(theme.accent),
  })
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");

  const footerLinks = plain(
    ((site as { footerLinks?: { label: string; href: string }[] }).footerLinks || [])
      .filter(Boolean)
      .map((l) => ({ ...l, href: safeHref(l.href) }))
      .filter((l) => l.href),
  );
  const socialLinks = plain(
    ((site as { socialLinks?: { label: string; href: string }[] }).socialLinks || [])
      .filter(Boolean)
      .map((l) => ({ ...l, href: safeHref(l.href) }))
      .filter((l) => l.href),
  );

  return (
    <>
      {css ? <style dangerouslySetInnerHTML={{ __html: `:root{${css}}` }} /> : null}
      <Header
        siteName={(site as { logoText?: string }).logoText || site.name || "Tharkoo"}
        countryName={site.countryName || "India"}
        searchPlaceholder={(site as { searchPlaceholder?: string }).searchPlaceholder || "Search by City, Category..."}
        postCta={(site as { postCta?: string }).postCta || "Post your ad"}
        categories={catProps}
        cities={plain(cities.map((c) => ({ slug: c.slug!, name: c.name!, stateSlug: c.stateSlug })))}
      />
      <MainInner>{children}</MainInner>
      <Footer
        siteName={site.name || "Tharkoo"}
        legalName={site.legalName || "SparkBeta Tech"}
        cityCount={cities.length}
        about={site.tagline || ""}
        categories={catProps}
        cities={plain(topCities.map((c) => ({ slug: c.slug!, name: c.name! })))}
        links={footerLinks}
        social={socialLinks}
      />
      {site.ageGateEnabled !== false ? (
        <AgeGate
          brand={(site as { logoText?: string }).logoText || site.name || "tharkoo"}
          title={(site as { ageGateTitle?: string }).ageGateTitle || "Please read the following warning before continuing"}
          body={
            (site as { ageGateBody?: string }).ageGateBody ||
            " <b>I am over 18 years old</b>  and I accept the viewing of explicit texts and images intended for an <b>adult audience</b>."
          }
          yes={(site as { ageYes?: string }).ageYes || "Accept"}
          no={(site as { ageNo?: string }).ageNo || "Decline"}
        />
      ) : null}
      <CookieBanner
        body={(site as { cookieBody?: string }).cookieBody}
        accept={(site as { cookieAccept?: string }).cookieAccept}
        necessary={(site as { cookieNecessary?: string }).cookieNecessary}
      />
    </>
  );
}
