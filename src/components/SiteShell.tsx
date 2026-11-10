import { cookies } from "next/headers";
import { userFromToken } from "@/server/auth/service";
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
}: {
  children: React.ReactNode;
  shell: Awaited<ReturnType<typeof loadShell>>;
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
  return (
    <CityProvider cities={cityProps}>
      <Header
        siteName={(site as { logoText?: string }).logoText || site.name || "Tharkoo"}
        countryName={site.countryName || "India"}
        searchPlaceholder={(site as { searchPlaceholder?: string }).searchPlaceholder || "Search jobs, homes, cars, pets..."}
        postCta={(site as { postCta?: string }).postCta || "Post an ad"}
        categories={catProps}
        cities={cityProps}
        user={user}
      />
      <MainInner>{children}</MainInner>
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
      <AgeGate brand="Tharkoo" title="Please confirm your age" body="Tharkoo is for people aged 18 and over. Confirm to continue." yes="I am 18 or over" no="Leave" />
      <CookieBanner body={(site as { cookieBody?: string }).cookieBody} />
    </CityProvider>
  );
}

export function SiteShell({
  children,
  shell,
}: {
  children: React.ReactNode;
  shell: Awaited<ReturnType<typeof loadShell>>;
}) {
  return <Chrome shell={shell}>{children}</Chrome>;
}
