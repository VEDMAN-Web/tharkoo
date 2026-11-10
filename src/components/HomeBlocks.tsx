import Link from "next/link";
import { HeroBand } from "./HeroBand";
import { safeHref, safeHtml } from "@/lib/sanitize";

type Block = {
  id: string;
  type: string;
  enabled: boolean;
  title?: string;
  subtitle?: string;
  body?: string;
  html?: string;
  cta?: string;
  href?: string;
  cityCount?: number;
  moreLabel?: string;
};

type Cat = {
  slug?: string;
  name?: string;
  description?: string;
  color?: string;
  showOnHome?: boolean;
  homeBlurb?: string;
  homeCities?: string[];
  moreLabel?: string;
};

type City = { slug?: string; name?: string };

export function HomeBlocks({
  blocks,
  categories,
  cities,
  postCta = "Post your ad",
  searchPlaceholder = "Search by City, Category...",
  siteName = "tharkoo",
}: {
  blocks: Block[];
  categories: Cat[];
  cities: City[];
  postCta?: string;
  searchPlaceholder?: string;
  siteName?: string;
}) {
  const visible = (blocks || []).filter((b) => b.enabled !== false);
  const hero = visible.find((b) => b.type === "hero");
  const catsBlock = visible.find((b) => b.type === "categories");
  const boost = visible.find((b) => b.type === "boost" || b.type === "banner");
  const html = visible.find((b) => b.type === "html");
  const onHome = categories.filter((c) => c.showOnHome !== false);
  const count = catsBlock?.cityCount || 3;
  const cityOrder = ["bangalore", "hyderabad", "delhi"];

  return (
    <div>
      <HeroBand
        brand={siteName}
        placeholder={searchPlaceholder}
        categories={onHome.map((c) => ({ slug: c.slug || "", name: c.name || "" }))}
        cities={cities.map((c) => ({ slug: c.slug || "", name: c.name || "" }))}
      />

      <div className="sk-container home-stack">
        <div className="home-post-wrap">
          <Link href={safeHref(boost?.href) || "/u/post-insert/"} className="btn-post btn-block home-post">
            {boost?.cta || postCta}
          </Link>
        </div>
        <div className="home-titles">
          <h1 className="main-title home">{hero?.title || "Classifieds in your city"}</h1>
          <h2 className="h2 home">{hero?.subtitle || "People, work, homes, and local services"}</h2>
        </div>
        <div className="home-grid">
          {onHome.map((cat, index) => {
            const featured = cityOrder
              .map((slug) => cities.find((c) => c.slug === slug))
              .filter(Boolean)
              .slice(0, count) as City[];
            const photo = `/placeholders/p${(index % 8) + 1}.jpg`;
            return (
              <article key={cat.slug} className="cat-card">
                <Link href={`/${cat.slug}/`} className="cat-card-photo" style={{ backgroundImage: `url(${photo})` }}>
                  <span className="profile-name">{cat.name}</span>
                </Link>
                <div className="cat-card-body">
                  <p>{cat.homeBlurb || cat.description}</p>
                  <ul>
                    {featured.map((city) => (
                      <li key={city.slug}>
                        <Link href={`/${cat.slug}/${city.slug}/`}>
                          <span className="homecategory">{cat.name}</span>
                          {city.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
        {html?.html ? (
          <div className="txt_seo" dangerouslySetInnerHTML={{ __html: safeHtml(html.html) }} />
        ) : null}
      </div>
    </div>
  );
}
