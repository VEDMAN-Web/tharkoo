import Link from "next/link";
import { HeroBand } from "./HeroBand";
import { AdCard, StarStrip } from "./AdCard";
import { AdCardSkeleton } from "./ui/Skeleton";
import { Container } from "./ui/Container";
import { Section } from "./ui/Section";
import { PlaceholderArt } from "./ui/PlaceholderArt";
import { RecentlyViewedRail } from "./ui/RecentlyViewed";
import { Button } from "./ui/Button";
import { JsonLd } from "@/lib/jsonld";
import { safeHtml } from "@/lib/sanitize";
import { canonical } from "@/lib/seo";
import { getCategories, getCities, getFeed, getSeo, getSite, getStarListings, getTopCities, listingCountsByCategoryCity } from "@/lib/queries";

export function SkeletonGrid() {
  return (
    <Container className="grid gap-4 py-8">
      {Array.from({ length: 6 }, (_, i) => (
        <AdCardSkeleton key={i} />
      ))}
    </Container>
  );
}

export async function HomeAbove() {
  const [site, categories, cities] = await Promise.all([getSite(), getCategories(), getCities()]);
  const counts = await listingCountsByCategoryCity().catch(() => []);
  const byCat = new Map<string, number>();
  counts.forEach((row) => {
    const slug = row._id.categorySlug;
    byCat.set(slug, (byCat.get(slug) || 0) + row.n);
  });
  const visible = categories.filter((cat) => cat.showOnHome !== false);
  const first = visible[0]?.slug;
  const top = cities.filter((city) => city.isTop).slice(0, 12);
  const cityLinks = (top.length ? top : cities.slice(0, 8)).map((city) => ({
    href: first ? `/${first}/${city.slug}/` : "/cities/",
    name: city.name,
    slug: city.slug,
  }));
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
      <HeroBand
        categories={visible.map((cat) => ({ slug: cat.slug || "", name: cat.name || "" }))}
        cities={cities.map((city) => ({ slug: city.slug || "", name: city.name || "" }))}
      />
      <Section eyebrow="Catalogue" title="Browse by category" action={{ href: "/cities/", label: "View all" }}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((cat) => (
            <Link key={cat.slug} href={`/${cat.slug}/`} prefetch={false} className="flex gap-3 rounded-lg border border-line bg-surface p-3">
              <span className="size-16 shrink-0 overflow-hidden rounded-md">
                <PlaceholderArt seed={cat.slug || cat.name || "cat"} category={cat.slug} decorative />
              </span>
              <span>
                <span className="t-h3 block">{cat.name}</span>
                <span className="t-caption text-muted">{byCat.get(cat.slug || "") || 0} listings</span>
              </span>
            </Link>
          ))}
        </div>
      </Section>
      <Section eyebrow="Places" title="Popular cities">
        <div className="flex flex-wrap gap-2">
          {cityLinks.map((city) => (
            <Link key={city.slug} href={city.href} prefetch={false} className="inline-flex h-9 items-center rounded-pill border border-line px-3 t-small">
              {city.name}
            </Link>
          ))}
          <Link href="/cities/" prefetch={false} className="inline-flex h-9 items-center rounded-pill border border-[color:var(--gold-line)] px-3 t-small text-gold">
            All cities
          </Link>
        </div>
      </Section>
    </>
  );
}

export async function HomeBelow() {
  const [seo, stars, feed] = await Promise.all([getSeo("home"), getStarListings({}), getFeed({}, 1)]);
  const cards = feed.items.slice(0, 12);
  return (
    <div className="below-fold">
      <Container>
        <StarStrip ads={stars} />
      </Container>
      <Section eyebrow="Latest" title="Fresh near you">
        <div className="grid gap-4">
          {cards.map((ad, index) => (
            <AdCard key={ad.slug || ad.publicId} ad={ad} priority={index === 0} />
          ))}
        </div>
      </Section>
      <Container>
        <RecentlyViewedRail />
      </Container>
      <Section title="Why Tharkoo">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Verified profiles", "A verified tick appears only after a profile check is recorded."],
            ["Manual ID checks", "Publishing some categories asks for an identity check first."],
            ["Safe by design", "Contact details stay hidden until you choose to reveal them."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-lg border border-line bg-surface p-4">
              <h3 className="t-h3">{title}</h3>
              <p className="t-small mt-2 text-muted">{body}</p>
            </div>
          ))}
        </div>
      </Section>
      <Container>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[color:var(--gold-line)] p-6">
          <div>
            <h2 className="t-h2">Post an ad</h2>
            <p className="t-small mt-2 text-muted">A basic ad can be saved as a draft, then sent for review.</p>
          </div>
          <Button href="/u/post-insert/">Post an ad</Button>
        </div>
        {seo?.intro ? (
          <div className="prose-block mt-12">
            <h2 className="t-h2">About these classifieds</h2>
            <div className="t-body mt-3 text-muted" dangerouslySetInnerHTML={{ __html: safeHtml(`<p>${seo.intro}</p>`) }} />
          </div>
        ) : null}
      </Container>
    </div>
  );
}

export async function HomeBlocks() {
  return (
    <>
      <HomeAbove />
      <HomeBelow />
    </>
  );
}

export async function loadTopCities() {
  return getTopCities();
}
