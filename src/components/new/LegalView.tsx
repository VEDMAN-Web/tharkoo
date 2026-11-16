import type { ReactNode } from "react";
import Link from "next/link";
import { PageBand } from "./PageParts";
import type { LegalSection } from "./legal-copy";

export type LegalCrumb = { label: string; href?: string };

export function LegalView({
  crumbs,
  title,
  updated,
  updatedPrefix = "Last updated",
  minutes,
  author,
  summary,
  sections,
  askHref,
  askLabel,
  cover,
}: {
  crumbs: LegalCrumb[];
  title: string;
  updated: string;
  updatedPrefix?: string;
  minutes: number;
  author?: string;
  summary?: string;
  sections: LegalSection[];
  askHref: string;
  askLabel: string;
  cover?: ReactNode;
}) {
  const withHeadings = sections.filter((section) => section.heading);
  return (
    <>
      <PageBand crumbs={crumbs} title={title} strong>
        <div className="tkp-pills">
          {updated ? <span className="tkp-pill">{updatedPrefix} {updated}</span> : null}
          <span className="tkp-pill">{minutes} min read</span>
          {author ? <span className="tkp-pill">{author}</span> : null}
        </div>
      </PageBand>

      <div className={withHeadings.length ? "tkp-legal" : "tkp-legal tkp-legal-solo"}>
        {cover}
        {withHeadings.length ? (
          <aside className="tkp-toc tkp-glass tkp-toc-hide-xs" aria-label="On this page">
            <p className="tkp-toc-title">On this page</p>
            <nav>
              {withHeadings.map((section) => (
                <a key={section.id} href={`#${section.id}`}>
                  {section.heading}
                </a>
              ))}
            </nav>
          </aside>
        ) : null}

        <article className="tkp-article">
          {summary ? (
            <div className="tkp-summary">
              <strong>In short:</strong> {summary}
            </div>
          ) : null}
          {sections.map((section) => (
            <section key={section.id} id={section.id === "intro" ? undefined : section.id}>
              {section.heading ? <h2>{section.heading}</h2> : null}
              {section.paragraphs.map((paragraph, index) => (
                <p key={`${section.id}-${index}`}>{paragraph}</p>
              ))}
            </section>
          ))}
          <div className="tkp-ask">
            <span>{askLabel}</span>
            <Link className="tkp-btn" href={askHref}>
              Contact us
            </Link>
          </div>
        </article>
      </div>
    </>
  );
}
