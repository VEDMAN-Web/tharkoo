import Link from "next/link";
import { categoriesPath, categoryPath } from "@/lib/urls";
import { HomeAdCard, type HomeAdCardData } from "./HomeAdCard";
import "./home-spec.css";
import "./p10-p13.css";

export type NotFoundCategory = { slug: string; name: string };

export type NotFoundAds = {
  eyebrow: string;
  title: string;
  seeAll: string;
  seeAllHref: string;
  labels: { view: string; online: string; away: string; watermark: string; views: string; viewOne: string };
  cards: (HomeAdCardData & { badge: string })[];
};

export function NotFoundView({ categories, ads }: { categories: NotFoundCategory[]; ads: NotFoundAds | null }) {
  return (
    <>
      <section className="tkp-section" style={{ paddingTop: 40 }}>
        <div className="tkp-glass tkp-404">
          <div className="tkp-404-num" aria-hidden="true">
            404
          </div>
          <h1>We could not find that page</h1>
          <p>The ad may have ended or the link is wrong.</p>
          <div className="tkp-404-actions">
            <Link className="tkp-btn" href="/">
              Back to home
            </Link>
            <Link className="tkp-btn-outline" href={categoriesPath()}>
              Browse categories
            </Link>
          </div>
          {categories.length ? (
            <nav aria-label="Popular categories" className="tkp-chips tkp-404-chips">
              {categories.map((category) => (
                <Link key={category.slug} className="tkp-chip" href={categoryPath(category.slug)}>
                  {category.name}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </section>

      {ads && ads.cards.length ? (
        <section className="tkp-section" style={{ paddingTop: 64 }} aria-labelledby="latest-ads">
          <div className="tkp-ads-head">
            <div>
              <p className="tkp-eyebrow">{ads.eyebrow}</p>
              <h2 id="latest-ads" className="tkp-h2">
                {ads.title}
              </h2>
            </div>
            <Link className="tkp-more-link" href={ads.seeAllHref}>
              {ads.seeAll}
            </Link>
          </div>
          <div className="tkh-ads">
            {ads.cards.map((ad) => (
              <HomeAdCard key={ad.slug} ad={ad} badge={ad.badge} labels={ads.labels} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
