import Link from "next/link";
import { CalendarDays, Heart, Leaf, MessageSquareHeart, Sparkles, Users, type LucideIcon } from "lucide-react";
import { SmartImage } from "./ui/SmartImage";
import { AdCardSkeleton } from "./ui/Skeleton";
import { JsonLd } from "@/lib/jsonld";
import { safeHtml } from "@/lib/sanitize";
import { canonical } from "@/lib/seo";
import { organizationNode, websiteNode } from "@/lib/seo/schema";
import { categoryPath, citiesPath, placePath, searchPath } from "@/lib/urls";
import { getCategories, getCities, getHomepageContent, getSeo, getSite, listingCountsByCategoryCity } from "@/lib/queries";
import { getPaths } from "@/server/urls/service";
import { cardFallback, type HomeCard } from "@/lib/ui/site-content";

const ICONS: Record<string, LucideIcon> = {
  dating: Heart,
  wellness: Leaf,
  friendship: Users,
  meetups: CalendarDays,
  "personal-ads": MessageSquareHeart,
};

type Cat = {
  slug?: string;
  name?: string;
  homeBlurb?: string;
  description?: string;
  homeCities?: string[];
};

export function SkeletonGrid() {
  return (
    <div className="tk-container grid gap-4 py-8">
      {Array.from({ length: 3 }, (_, i) => (
        <AdCardSkeleton key={i} />
      ))}
    </div>
  );
}

function iconFor(slug: string) {
  return ICONS[slug] || Sparkles;
}

export async function HomeBlocks() {
  const [site, categories, cities, seo, content, paths, counts] = await Promise.all([
    getSite(),
    getCategories(),
    getCities(),
    getSeo("home"),
    getHomepageContent(),
    getPaths(),
    listingCountsByCategoryCity().catch(() => []),
  ]);
  const liveKeys = new Set(counts.filter((row) => row.n > 0).map((row) => `${row._id.categorySlug}|${row._id.citySlug}`));
  const bySlug = new Map(categories.map((cat) => [cat.slug, cat as Cat]));
  const cityBySlug = new Map(cities.map((city) => [city.slug, city]));
  const top = cities.filter((city) => city.isTop).slice(0, 5);
  const cards = content.cards.filter((card) => card.visible && bySlug.has(card.slug));
  const configured = new Set(content.cards.map((card) => card.slug));
  const rest = categories.filter((cat) => !configured.has(cat.slug || "")).slice(0, 8);
  const firstCategory = categories[0]?.slug || "dating";
  const topCities = cities.filter((city) => city.isTop);
  const browseCities = topCities.length ? topCities : cities.slice(0, 12);
  const moreGroup = content.groups.find((group) => group.visible && group.kind === "categories");
  const moreCategories = moreGroup?.cities.length
    ? moreGroup.cities.map((slug) => bySlug.get(slug)).filter((cat): cat is Cat => Boolean(cat?.slug))
    : rest;

  function picksFor(card: HomeCard, cat: Cat) {
    const chosen = card.cities.map((slug) => cityBySlug.get(slug)).filter(Boolean);
    if (chosen.length) return chosen;
    const homes = (cat.homeCities || []).map((slug) => cityBySlug.get(slug)).filter(Boolean).slice(0, 3);
    const list = homes.length ? homes : top.slice(0, 3);
    if (!liveKeys.size) return list;
    const filtered = list.filter((city) => liveKeys.has(`${card.slug}|${city!.slug}`));
    return filtered.length ? filtered : list;
  }

  return (
    <>
      <JsonLd
        data={[
          organizationNode(site.name || "Tharkoo", {
            logo: canonical("/brand/logo-mark.svg"),
            sameAs: content.socials.map((item) => item.href),
          }),
          websiteNode(site.name || "Tharkoo", searchPath(paths)),
        ]}
      />
      <div className="tk-home-head tk-container">
        <h2>{content.cardsHeading}</h2>
        <p>{content.cardsIntro}</p>
      </div>
      <div className="tk-container tk-home-grid">
        {cards.map((card) => {
          const cat = bySlug.get(card.slug)!;
          const Icon = iconFor(card.slug);
          const title = card.title || cat.name;
          const picks = picksFor(card, cat);
          return (
            <article key={card.slug} className="tk-home-card" data-tk="home-card">
              <Link href={categoryPath(cat.slug || "")} className="tk-home-photo" prefetch={false}>
                <SmartImage
                  src={card.photo || `/placeholders/${cat.slug}/01.webp`}
                  alt={`${title || "Category"} classifieds`}
                  seed={cat.slug || "cat"}
                  category={cat.slug}
                  width={600}
                  height={402}
                  sizes="300px"
                />
                <span className="tk-home-shade" />
                <span className="tk-home-title">
                  <Icon size={20} /> {title}
                </span>
              </Link>
              <div className="tk-home-body">
                <p>{card.blurb || cat.homeBlurb || cat.description || cardFallback(card.slug)}</p>
                <div className="tk-city-pills">
                  {picks.map((city) => (
                    <Link key={city!.slug} href={placePath(cat.slug || "", city!.slug || "")} className="tk-city-row" prefetch={false}>
                      {city!.name}
                    </Link>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {content.seoIntro || seo?.intro ? (
        <div className="tk-seo" dangerouslySetInnerHTML={{ __html: safeHtml(content.seoIntro || seo?.intro || "") }} />
      ) : null}
      <div className="tk-container tk-groups">
        <section className="tk-group" data-tk="city-group">
          <h3>Browse by city</h3>
          <div className="tk-pills">
            {browseCities.map((city) => (
              <Link key={city.slug} href={placePath(firstCategory, city.slug || "")} className="tk-pill" prefetch={false}>
                {city.name}
              </Link>
            ))}
            <Link href={citiesPath(paths)} className="tk-pill" prefetch={false}>
              All cities
            </Link>
          </div>
        </section>
        {moreCategories.length ? (
          <section className="tk-group" data-tk="city-group">
            <h3>{moreGroup?.title || "More categories"}</h3>
            <div className="tk-pills">
              {moreCategories.map((cat) => (
                <Link key={cat.slug} href={categoryPath(cat.slug || "")} className="tk-pill" prefetch={false}>
                  {cat.name}
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}

export async function HomeAbove() {
  return null;
}

export async function HomeBelow() {
  return null;
}

export async function HeroStats() {
  return null;
}

export async function loadTopCities() {
  const { getTopCities } = await import("@/lib/queries");
  return getTopCities();
}
