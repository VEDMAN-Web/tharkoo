import Link from "next/link";
import { categoriesPath, categoryPath } from "@/lib/urls";
import "./p10-p13.css";

export type NotFoundCategory = { slug: string; name: string };

export function NotFoundView({ categories }: { categories: NotFoundCategory[] }) {
  return (
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
  );
}
