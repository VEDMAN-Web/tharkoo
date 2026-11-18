import Link from "next/link";
import { categoriesPath, categoryPath } from "@/lib/urls";
import { ListingRow, type ListingRowLabels } from "./ListingRow";
import type { ListingRowData } from "./listing-row-data";
import "./home-spec.css";
import "./p10-p13.css";

export type NotFoundCategory = { slug: string; name: string };

export type NotFoundAds = {
  eyebrow: string;
  title: string;
  seeAll: string;
  seeAllHref: string;
  labels: ListingRowLabels;
  cards: ListingRowData[];
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
          <div className="tkh-head">
            <div>
              <p className="tkh-eyebrow tkh-eyebrow-lavender">{ads.eyebrow}</p>
              <h2 id="latest-ads" className="tkh-h2">
                {ads.title}
              </h2>
            </div>
            <Link className="tkh-more" href={ads.seeAllHref}>
              {ads.seeAll}
            </Link>
          </div>
          <ul className="tk-rows" aria-label={ads.title}>
            {ads.cards.map((ad, position) => (
              <li key={ad.slug}>
                <ListingRow ad={ad} labels={ads.labels} order={position} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
