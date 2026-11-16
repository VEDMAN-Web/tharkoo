import type { ReactNode } from "react";
import Link from "next/link";
import "./home-ads.css";

export function HomeAdsSection({
  id,
  eyebrow,
  title,
  listLabel,
  moreHref,
  moreText,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  listLabel: string;
  moreHref: string;
  moreText: string;
  children: ReactNode;
}) {
  return (
    <section className="tkh-page tkh-section" aria-labelledby={id}>
      <div className="tkh-head">
        <div>
          <p className="tkh-eyebrow tkh-eyebrow-lavender">{eyebrow}</p>
          <h2 id={id} className="tkh-h2">
            {title}
          </h2>
        </div>
        <div className="tkh-head-tools">
          <Link className="tkh-more" href={moreHref} prefetch={false}>
            {moreText}
          </Link>
        </div>
      </div>
      <ul className="tkh-ads" aria-label={listLabel} data-tk="ads-row">
        {children}
      </ul>
    </section>
  );
}
