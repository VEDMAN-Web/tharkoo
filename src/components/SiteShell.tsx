import { AgeGate } from "./AgeGate";
import { CookieBanner } from "./CookieBanner";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { getCategories, getSite, getTopCities } from "@/lib/queries";

export async function SiteShell({ children }: { children: React.ReactNode }) {
  const [site, categories, cities] = await Promise.all([getSite(), getCategories(), getTopCities()]);
  const catProps = categories.map((c) => ({ slug: c.slug!, name: c.name! }));
  const cityProps = cities.map((c) => ({ slug: c.slug!, name: c.name! }));
  return (
    <>
      <Header
        siteName={site.name || "Tharkoo"}
        countryName={site.countryName || "India"}
        categories={catProps}
        cities={cityProps}
      />
      <main className="container-site flex-1 py-6">{children}</main>
      <Footer
        siteName={site.name || "Tharkoo"}
        legalName={site.legalName || "SparkBeta Tech"}
        cityCount={100}
        about={
          site.tagline ||
          "Adult classifieds in India. Browse Call Girls, Massages, Male Escorts, Transsexual and Adult Meetings. Post your ad free."
        }
        categories={catProps}
        cities={cityProps}
      />
      {site.ageGateEnabled ? <AgeGate /> : null}
      <CookieBanner />
    </>
  );
}
