import Link from "next/link";
import { CalendarDays, Heart, Leaf, MessageSquareHeart, Users, type LucideIcon } from "lucide-react";
import { SmartImage } from "./ui/SmartImage";
import { AdCardSkeleton } from "./ui/Skeleton";
import { JsonLd } from "@/lib/jsonld";
import { safeHtml } from "@/lib/sanitize";
import { canonical } from "@/lib/seo";
import { getCategories, getCities, getSeo, getSite } from "@/lib/queries";

const SLOTS: { slug: string; icon: LucideIcon; fallback: string }[] = [
  { slug: "dating", icon: Heart, fallback: "Meet people near you. Clear profiles, honest details, and manual ID checks." },
  { slug: "wellness", icon: Leaf, fallback: "Spa, yoga, fitness and therapeutic massage bookings from verified providers." },
  { slug: "friendship", icon: Users, fallback: "Make friends and find company for coffee, trips and hobbies." },
  { slug: "meetups", icon: CalendarDays, fallback: "Join local meetups, classes and group activities in your city." },
  { slug: "personal-ads", icon: MessageSquareHeart, fallback: "Short personal notices for dating, friendship and activities." },
];

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

export async function HomeBlocks() {
  const [site, categories, cities, seo] = await Promise.all([getSite(), getCategories(), getCities(), getSeo("home")]);
  const bySlug = new Map(categories.map((cat) => [cat.slug, cat as Cat]));
  const cityBySlug = new Map(cities.map((city) => [city.slug, city]));
  const top = cities.filter((city) => city.isTop).slice(0, 5);
  const featured = SLOTS.map((slot) => bySlug.get(slot.slug)).filter((cat): cat is Cat => Boolean(cat?.slug));
  const rest = categories.filter((cat) => !SLOTS.some((slot) => slot.slug === cat.slug)).slice(0, 6);

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
        <h2>Hot meetings in your city</h2>
        <p>Find your favourite listings on Tharkoo</p>
      </div>
      <div className="tk-container tk-home-grid">
        {featured.map((cat) => {
          const slot = SLOTS.find((item) => item.slug === cat.slug)!;
          const Icon = slot.icon;
          const homes = (cat.homeCities || []).map((slug) => cityBySlug.get(slug)).filter(Boolean).slice(0, 3);
          const picks = homes.length ? homes : top.slice(0, 3);
          return (
            <article key={cat.slug} className="tk-home-card" data-tk="home-card">
              <Link href={`/${cat.slug}/`} className="tk-home-photo" prefetch={false}>
                <SmartImage
                  src={`/placeholders/${cat.slug}/01.webp`}
                  alt=""
                  seed={cat.slug || "cat"}
                  category={cat.slug}
                  width={600}
                  height={402}
                  sizes="300px"
                />
                <span className="tk-home-shade" />
                <span className="tk-home-title">
                  <Icon size={20} /> {cat.name}
                </span>
              </Link>
              <div className="tk-home-body">
                <p>{cat.homeBlurb || cat.description || slot.fallback}</p>
                {picks.map((city) => (
                  <Link key={city!.slug} href={`/${cat.slug}/${city!.slug}/`} className="tk-city-row" prefetch={false}>
                    <span>{cat.name}</span>
                    <strong>{city!.name}</strong>
                  </Link>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      {seo?.intro ? (
        <div className="tk-seo" dangerouslySetInnerHTML={{ __html: safeHtml(seo.intro) }} />
      ) : null}
      <div className="tk-container tk-groups">
        {featured.map((cat, index) => {
          const slot = SLOTS.find((item) => item.slug === cat.slug)!;
          const Icon = slot.icon;
          const pills = top.slice(0, index === 0 ? 5 : 5);
          return (
            <section key={cat.slug} className="tk-group" data-tk="city-group">
              <h3>
                <Link href={`/${cat.slug}/`} prefetch={false}>
                  <Icon size={16} /> {cat.name}
                </Link>
              </h3>
              <div className="tk-pills">
                {pills.map((city) => (
                  <Link key={city.slug} href={`/${cat.slug}/${city.slug}/`} className="tk-pill" prefetch={false}>
                    {city.name}
                  </Link>
                ))}
                {index === 0 ? (
                  <Link href="/cities/" className="tk-pill" prefetch={false}>
                    All cities
                  </Link>
                ) : null}
              </div>
            </section>
          );
        })}
        <section className="tk-group" data-tk="city-group">
          <h3>More categories</h3>
          <div className="tk-pills">
            {rest.map((cat) => (
              <Link key={cat.slug} href={`/${cat.slug}/`} className="tk-pill" prefetch={false}>
                {cat.name}
              </Link>
            ))}
          </div>
        </section>
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
