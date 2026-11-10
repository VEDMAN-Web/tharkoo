import Link from "next/link";
import { CalendarDays, Heart, Leaf, MessageSquareHeart, Sparkles, Users, type LucideIcon } from "lucide-react";
import { SmartImage } from "./ui/SmartImage";
import { AdCardSkeleton } from "./ui/Skeleton";
import { JsonLd } from "@/lib/jsonld";
import { safeHtml } from "@/lib/sanitize";
import { canonical } from "@/lib/seo";
import { getCategories, getCities, getHomepageContent, getSeo, getSite } from "@/lib/queries";
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
  const [site, categories, cities, seo, content] = await Promise.all([
    getSite(),
    getCategories(),
    getCities(),
    getSeo("home"),
    getHomepageContent(),
  ]);
  const bySlug = new Map(categories.map((cat) => [cat.slug, cat as Cat]));
  const cityBySlug = new Map(cities.map((city) => [city.slug, city]));
  const top = cities.filter((city) => city.isTop).slice(0, 5);
  const cards = content.cards.filter((card) => card.visible && bySlug.has(card.slug));
  const configured = new Set(content.cards.map((card) => card.slug));
  const rest = categories.filter((cat) => !configured.has(cat.slug || "")).slice(0, 8);

  function picksFor(card: HomeCard, cat: Cat) {
    const chosen = card.cities.map((slug) => cityBySlug.get(slug)).filter(Boolean);
    if (chosen.length) return chosen;
    const homes = (cat.homeCities || []).map((slug) => cityBySlug.get(slug)).filter(Boolean).slice(0, 3);
    return homes.length ? homes : top.slice(0, 3);
  }

  return (
    <>
      <JsonLd
        data={[
          { "@context": "https://schema.org", "@type": "Organization", name: site.name, url: canonical("/") },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: site.name,
            url: canonical("/"),
            potentialAction: {
              "@type": "SearchAction",
              target: `${canonical("/search/")}?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          },
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
              <Link href={`/${cat.slug}/`} className="tk-home-photo" prefetch={false}>
                <SmartImage
                  src={card.photo || `/placeholders/${cat.slug}/01.webp`}
                  alt=""
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
                {picks.map((city) => (
                  <Link key={city!.slug} href={`/${cat.slug}/${city!.slug}/`} className="tk-city-row" prefetch={false}>
                    <span>{title}</span>
                    <strong>{city!.name}</strong>
                  </Link>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      {content.seoIntro || seo?.intro ? (
        <div className="tk-seo" dangerouslySetInnerHTML={{ __html: safeHtml(content.seoIntro || seo?.intro || "") }} />
      ) : null}
      <div className="tk-container tk-groups">
        {content.groups.filter((group) => group.visible).map((group) => {
          if (group.kind === "categories") {
            const extra = group.cities.length
              ? group.cities.map((slug) => bySlug.get(slug)).filter((cat): cat is Cat => Boolean(cat?.slug))
              : rest;
            return (
              <section key={group.id} className="tk-group" data-tk="city-group">
                <h3>{group.title || "More categories"}</h3>
                <div className="tk-pills">
                  {extra.map((cat) => (
                    <Link key={cat.slug} href={`/${cat.slug}/`} className="tk-pill" prefetch={false}>
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </section>
            );
          }
          const cat = bySlug.get(group.slug);
          if (!cat?.slug) return null;
          const Icon = iconFor(group.slug);
          const title = group.title || cat.name;
          const chosen = group.cities.map((slug) => cityBySlug.get(slug)).filter(Boolean);
          const pills = chosen.length ? chosen : top.slice(0, 5);
          return (
            <section key={group.id} className="tk-group" data-tk="city-group">
              <h3>
                <Link href={`/${cat.slug}/`} prefetch={false}>
                  <Icon size={16} /> {title}
                </Link>
              </h3>
              <div className="tk-pills">
                {pills.map((city) => (
                  <Link key={city!.slug} href={`/${cat.slug}/${city!.slug}/`} className="tk-pill" prefetch={false}>
                    {city!.name}
                  </Link>
                ))}
                {group.showAll ? (
                  <Link href="/cities/" className="tk-pill" prefetch={false}>
                    All cities
                  </Link>
                ) : null}
              </div>
            </section>
          );
        })}
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
