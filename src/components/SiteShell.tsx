import { AgeGate } from "./AgeGate";
import { CookieBanner } from "./CookieBanner";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { getCategories, getCities, getSite, getTopCities } from "@/lib/queries";
import { plain } from "@/lib/plain";

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
    "--sk-pink": theme.accent,
    "--sk-blue": theme.primary,
    "--sk-page": theme.page,
    "--sk-top": theme.top,
    "--sk-link": theme.link,
    "--brand-primary": theme.primary,
    "--brand-accent": theme.accent,
  })
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");

  const footerLinks = plain(((site as { footerLinks?: { label: string; href: string }[] }).footerLinks || []).filter(Boolean));
  const socialLinks = plain(((site as { socialLinks?: { label: string; href: string }[] }).socialLinks || []).filter(Boolean));

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
      <main className="container-site flex-1 py-6">{children}</main>
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
      {site.ageGateEnabled ? (
        <AgeGate
          brand={(site as { logoText?: string }).logoText || site.name || "tharkoo"}
          title={(site as { ageGateTitle?: string }).ageGateTitle || "Are you over 18?"}
          body={(site as { ageGateBody?: string }).ageGateBody || "This website contains adult material. You must be 18 years or older to enter."}
          yes={(site as { ageYes?: string }).ageYes || "I'm over 18"}
          no={(site as { ageNo?: string }).ageNo || "I'm under 18"}
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
