import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ListingDoc } from "@/lib/models";
import { AdCard } from "@/components/ui/AdCard";
import { categoryPath, applyPrefixes, type UrlPaths } from "@/lib/urls";
import type { ShellConfig } from "@/server/site-links/shell-config-rules";
import { NewSearchBar } from "./NewSearchBar";
import "./new-design.css";

type Cat = { slug?: string; name?: string; homeBlurb?: string; description?: string };
type Hero = { photo: string; photoAlt: string; desktop: string; searchPlaceholder: string };

const BLURB_MAX = 70;

function blurbOf(cat: Cat) {
  const text = (cat.homeBlurb || cat.description || "").replace(/\s+/g, " ").trim();
  return text.length > BLURB_MAX ? `${text.slice(0, BLURB_MAX - 1)}…` : text;
}

/**
 * H7.4: the New design home page, as in the Home mockup. Every visible line comes from the page content, the
 * shell config (trust pills, How it works, category photos) or the catalogue; the code keeps only the defaults.
 */
export function NewHome({
  hero,
  categories,
  ads,
  shell,
  paths,
}: {
  hero: Hero;
  categories: Cat[];
  ads: ListingDoc[];
  shell: ShellConfig;
  paths: UrlPaths;
}) {
  const photos = new Map(shell.media.images.filter((image) => image.scope === "category" && image.photo).map((image) => [image.slug, image.photo]));
  const localPhoto = hero.photo.startsWith("/");
  const cats = categories.filter((cat) => cat.slug && cat.name).slice(0, 8);
  return (
    <div className="tkn-home">
      <section className="tkn-page" aria-label="Banner">
        <div className="tkn-hero">
          {localPhoto ? (
            <Image className="tkn-hero-img" src={hero.photo} alt={hero.photoAlt} width={1280} height={420} priority sizes="(max-width: 1280px) 100vw, 1280px" />
          ) : (
            <img className="tkn-hero-img" src={hero.photo} alt={hero.photoAlt} width={1280} height={420} />
          )}
          <div className="tkn-hero-copy">
            <h1>{hero.desktop}</h1>
            <p>{shell.footer.about}</p>
          </div>
        </div>
        <NewSearchBar label={hero.searchPlaceholder} />
        <ul className="tkn-trust" aria-label="Why Tharkoo">
          {shell.home.trust.map((pill) => (
            <li key={pill.label} className={`tkn-tone-${pill.tone}`}>
              <i aria-hidden="true" />
              {pill.label}
            </li>
          ))}
        </ul>
      </section>

      <section className="tkn-page tkn-section" aria-labelledby="home-cats">
        <div className="tkn-section-head">
          <div>
            <p className="tkn-eyebrow">Browse</p>
            <h2 id="home-cats" className="tkn-h2">Popular categories</h2>
          </div>
          <Link className="tkn-more" href={applyPrefixes("/categories/", paths)} prefetch={false}>All categories</Link>
        </div>
        <ul className="tkn-cats">
          {cats.map((cat) => {
            const slug = cat.slug || "";
            const photo = photos.get(slug);
            return (
              <li key={slug}>
                <Link className="tkn-cat" href={applyPrefixes(categoryPath(slug), paths)} prefetch={false}>
                  {photo ? <img className="tkn-cat-photo" src={photo} alt="" width={480} height={320} loading="lazy" /> : <span className="tkn-cat-photo" aria-hidden="true" />}
                  <span className="tkn-cat-strip">
                    <span className="tkn-cat-text">
                      <span className="tkn-cat-name">{cat.name}</span>
                      <span className="tkn-cat-line">{blurbOf(cat)}</span>
                    </span>
                    <span className="tkn-cat-arrow" aria-hidden="true"><ArrowRight size={16} /></span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {ads.length ? (
        <section className="tkn-page tkn-section" aria-labelledby="home-fresh">
          <div className="tkn-section-head">
            <div>
              <p className="tkn-eyebrow tkn-eyebrow-violet">Fresh today</p>
              <h2 id="home-fresh" className="tkn-h2">Latest ads</h2>
            </div>
            <Link className="tkn-more" href={applyPrefixes("/search/", paths)} prefetch={false}>See all ads</Link>
          </div>
          <div className="tkn-ads">
            {ads.slice(0, 4).map((ad) => (
              <AdCard key={ad.slug} ad={ad} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="tkn-page tkn-section" aria-labelledby="home-how">
        <div className="tkn-section-head">
          <div>
            <p className="tkn-eyebrow">Simple</p>
            <h2 id="home-how" className="tkn-h2">How Tharkoo works</h2>
          </div>
        </div>
        <ol className="tkn-steps">
          {shell.home.steps.map((step, index) => (
            <li className="tkn-step" key={step.title}>
              <span className="tkn-step-n" aria-hidden="true">{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
