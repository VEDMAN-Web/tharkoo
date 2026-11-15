import Link from "next/link";
import { Icon, PageBand } from "./PageParts";
import { bodyParagraphs, readingMinutes } from "./legal-copy";

export type BlogPostCard = {
  slug: string;
  title: string;
  date: string;
  body: string;
  category: string;
  href: string;
};

type Card = { href: string; title: string; date: string; minutes: number; excerpt: string; category: string };

function excerptOf(body: string): string {
  const first = bodyParagraphs(body).find((paragraph) => !paragraph.startsWith("## ")) || "";
  return first.length > 160 ? `${first.slice(0, 157).replace(/\s+\S*$/, "")}…` : first;
}

function toCard(post: BlogPostCard): Card {
  return {
    href: post.href,
    title: post.title,
    date: post.date,
    category: post.category,
    minutes: readingMinutes(bodyParagraphs(post.body)),
    excerpt: excerptOf(post.body),
  };
}

export function BlogList({
  posts,
  categories,
  active,
  page,
  pages,
  basePath,
}: {
  posts: BlogPostCard[];
  categories: string[];
  active: string;
  page: number;
  pages: number;
  basePath: string;
}) {
  const hrefOf = (category: string, pageNumber = 1) => {
    const query = [category && `category=${encodeURIComponent(category)}`, pageNumber > 1 && `page=${pageNumber}`].filter(Boolean).join("&");
    return query ? `${basePath}?${query}` : basePath;
  };
  const cards = posts.map(toCard);
  const [feature, ...rest] = cards;
  return (
    <>
      <PageBand crumbs={[{ label: "Tharkoo India", href: "/" }, { label: "Blog" }]} title="Tips, guides and city news" strong>
        <p className="tkp-lede">Short reads to help you buy, sell and meet safely.</p>
        <nav aria-label="Categories" className="tkp-chips tkp-chips-scroll" style={{ marginTop: 18 }}>
          <Link href={hrefOf("")} className="tkp-chip" aria-current={active ? undefined : "page"}>
            All
          </Link>
          {categories.map((category) => (
            <Link key={category} href={hrefOf(category)} className="tkp-chip" aria-current={active === category ? "page" : undefined}>
              {category}
            </Link>
          ))}
        </nav>
      </PageBand>

      {feature ? (
        <section className="tkp-section" aria-label="Featured article">
          <Link href={feature.href} className="tkp-feature">
            <div className="tkp-feature-cover" aria-hidden="true" />
            <div className="tkp-feature-body">
              {feature.category ? <span className="tkp-tag">{feature.category}</span> : null}
              <h2 className="tkp-feature-title">{feature.title}</h2>
              {feature.excerpt ? <p className="tkp-feature-text">{feature.excerpt}</p> : null}
              <span className="tkp-post-date">
                {feature.date ? `${feature.date} · ` : ""}
                {feature.minutes} min read
              </span>
              <span className="tkp-read">
                Read the article <Icon name="arrow" size={16} color="#C2185B" width={2.4} />
              </span>
            </div>
          </Link>
        </section>
      ) : (
        <section className="tkp-section">
          <p className="tkp-lede">No articles yet. Check back soon.</p>
        </section>
      )}

      {rest.length ? (
        <section className="tkp-section" aria-label="More articles">
          <div className="tkp-grid3">
            {rest.map((card) => (
              <article key={card.href} className="tkp-blog-card m-lift" data-reveal>
                <div className="tkp-post-cover" aria-hidden="true" />
                <div className="tkp-post-body">
                  {card.category ? <span className="tkp-post-tag">{card.category}</span> : null}
                  <h3 className="tkp-post-title">{card.title}</h3>
                  <span className="tkp-post-date">
                    {card.date ? `${card.date} · ` : ""}
                    {card.minutes} min read
                  </span>
                  <Link href={card.href} className="tkp-post-more">
                    Read article
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {pages > 1 ? (
        <section className="tkp-section">
          <nav aria-label="Pages" className="tkp-pages">
            {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
              <Link key={number} href={hrefOf(active, number)} className="tkp-page-link" aria-current={number === page ? "page" : undefined}>
                {number}
              </Link>
            ))}
          </nav>
        </section>
      ) : null}
    </>
  );
}
