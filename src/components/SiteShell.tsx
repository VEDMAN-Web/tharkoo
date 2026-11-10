import { cookies } from "next/headers";
import { userFromToken } from "@/server/auth/service";
import { JsonLd } from "@/lib/jsonld";
import { canonical } from "@/lib/seo";
import { AgeGate } from "./AgeGate";
import { CityProvider } from "./CityContext";
import { CookieBanner } from "./CookieBanner";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { MainInner } from "./MainInner";
import { getCategories, getCities, getSite, getTopCities } from "@/lib/queries";
import { plain } from "@/lib/plain";
import { safeHref } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

async function viewer() {
  const token = (await cookies()).get("sid")?.value;
  if (!token) return null;
  try {
    const found = await userFromToken(token);
    if (!found) return null;
    return { email: found.user.email, roles: found.user.roles };
  } catch {
    return null;
  }
}

export async function loadShell() {
  const [site, categories, topCities, cities, user] = await Promise.all([
    getSite(),
    getCategories(),
    getTopCities(),
    getCities(),
    viewer(),
  ]);
  return { site, categories, topCities, cities, user };
}

function Chrome({
  children,
  shell,
  pathname,
}: {
  children: React.ReactNode;
  shell: Awaited<ReturnType<typeof loadShell>>;
  pathname: string;
}) {
  const { site, categories, topCities, cities, user } = shell;
  const catProps = plain(categories.map((c) => ({ slug: c.slug!, name: c.name! })));
  const cityProps = plain(cities.map((c) => ({ slug: c.slug!, name: c.name!, stateSlug: c.stateSlug })));
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
  const pageName = pathname === "/" ? site.name || "Tharkoo" : pathname;
  return (
    <CityProvider cities={cityProps}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: String(pageName),
          url: canonical(pathname),
          isPartOf: { "@type": "WebSite", name: site.name || "Tharkoo", url: canonical("/") },
        }}
      />
      <Header
        siteName={(site as { logoText?: string }).logoText || site.name || "Tharkoo"}
        countryName={site.countryName || "India"}
        searchPlaceholder={(site as { searchPlaceholder?: string }).searchPlaceholder || "Search By City, Category..."}
        postCta="POST YOUR AD"
        categories={catProps}
        cities={cityProps}
        user={user}
        social={socialLinks}
      />
      <MainInner>{children}</MainInner>
      <div
        id="tk-facts"
        hidden
        data-hours={site.supportHours || "Monday through Friday"}
        data-wa={"supportWhatsapp" in site ? site.supportWhatsapp || "" : ""}
        data-tg={"supportTelegram" in site ? site.supportTelegram || "" : ""}
      />
      <Footer
        siteName={site.name || "Tharkoo"}
        legalName={site.legalName || "Tharkoo"}
        cityCount={cities.length}
        about={site.tagline || ""}
        categories={catProps}
        cities={plain(topCities.map((c) => ({ slug: c.slug!, name: c.name! })))}
        links={footerLinks}
        social={socialLinks}
      />
      <AgeGate brand="Tharkoo" title="Please confirm your age before continuing" body="I am over 18 years old and I accept the terms of use of this site." yes="ACCEPT" no="Decline" />
      <CookieBanner body={(site as { cookieBody?: string }).cookieBody} />
    </CityProvider>
  );
}

export function SiteShell({
  children,
  shell,
  pathname = "/",
  admin = false,
}: {
  children: React.ReactNode;
  shell: Awaited<ReturnType<typeof loadShell>>;
  pathname?: string;
  admin?: boolean;
}) {
  if (admin) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <main id="main">{children}</main>
      </div>
    );
  }
  return (
    <Chrome shell={shell} pathname={pathname}>
      {children}
    </Chrome>
  );
}
