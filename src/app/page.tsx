import type { ComponentProps } from "react";
import { HomeBlocks } from "@/components/HomeBlocks";
import { JsonLd } from "@/lib/jsonld";
import { getCategories, getSeo, getSite, getTopCities } from "@/lib/queries";
import { canonical } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [site, seo, categories, cities] = await Promise.all([
    getSite(),
    getSeo("home"),
    getCategories(),
    getTopCities(),
  ]);
  const stored = (site as { homepage?: { blocks?: object[] } }).homepage?.blocks;
  const blocks = (stored && stored.length
    ? stored
    : [
        { id: "hero", type: "hero", enabled: true, title: seo?.h1 || "Hot meetings in your city", subtitle: seo?.h2 || "" },
        { id: "categories", type: "categories", enabled: true, cityCount: 3, moreLabel: "More cities" },
        {
          id: "boost",
          type: "boost",
          enabled: true,
          title: "Boost your visibility",
          body: "Post your ad free. Promote with Top, Flash or Star.",
          cta: "Post your ad",
          href: "/u/post-insert/",
        },
        { id: "intro", type: "html", enabled: true, html: `<p>${seo?.intro || ""}</p>` },
      ]) as ComponentProps<typeof HomeBlocks>["blocks"];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: site.name,
          url: canonical("/"),
        }}
      />
      <HomeBlocks
        blocks={blocks}
        categories={categories}
        cities={cities.map((c) => ({ slug: c.slug, name: c.name }))}
      />
    </>
  );
}
