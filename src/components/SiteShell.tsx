import { AgeGate } from "./AgeGate";
import { CookieBanner } from "./CookieBanner";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { getCategories, getSite, getTopCities } from "@/lib/queries";

export async function SiteShell({ children }: { children: React.ReactNode }) {
  const [site, categories, cities] = await Promise.all([getSite(), getCategories(), getTopCities()]);
  return (
    <>
      <Header
        siteName={site.name || "Tharkoo"}
        countryName={site.countryName || "India"}
        categories={categories.map((c) => ({ slug: c.slug!, name: c.name! }))}
        cities={cities.map((c) => ({ slug: c.slug!, name: c.name! }))}
      />
      <main className="container-site flex-1 py-6">{children}</main>
      <Footer
        siteName={site.name || "Tharkoo"}
        legalName={site.legalName || "SparkBeta Tech"}
        cityCount={100}
        about={site.tagline || "City classifieds for India."}
      />
      {site.ageGateEnabled ? <AgeGate /> : null}
      <CookieBanner />
    </>
  );
}
