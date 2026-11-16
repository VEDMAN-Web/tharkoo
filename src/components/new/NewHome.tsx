import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ListingDoc } from "@/lib/models";
import { prettyPlace } from "@/lib/format";
import { applyPrefixes, categoryPath, postAdPath, type UrlPaths } from "@/lib/urls";
import { NewAdsGate } from "./NewAdsGate";
import { makeT, type UiTextMap } from "@/lib/ui/text";
import type { ShellConfig } from "@/server/site-links/shell-config-rules";
import { HomeAdCard } from "./HomeAdCard";
import { HomeAdsSection } from "./HomeAdsSection";
import { homeAdCardData } from "./home-ad-data";
import { HomeSearchForm } from "./HomeSearchForm";
import type { CountryPlaces } from "@/server/locations/site-country";
import { commonCity, splitHeadline } from "./home-copy";
import "./home-spec.css";

type Cat = { slug?: string; name?: string; homeBlurb?: string; description?: string; icon?: string; kind?: string };
type Hero = {
  photo: string;
  photoPhone?: string;
  photoAlt: string;
  desktop: string;
  searchPlaceholder: string;
  focusX?: number;
  focusY?: number;
  phoneFocusX?: number;
  phoneFocusY?: number;
  textInImage?: boolean;
  photoWidth?: number;
  photoHeight?: number;
};

const BLURB_MAX = 70;
const HOME_ADS_SHOWN = 8;
const TEXT_IMAGE_W = 2400;
const TEXT_IMAGE_H = 1029;

function blurbOf(cat: Cat) {
  const text = (cat.homeBlurb || cat.description || "").replace(/\s+/g, " ").trim();
  return text.length > BLURB_MAX ? `${text.slice(0, BLURB_MAX - 1)}…` : text;
}

/** H7.4c / H7.10: the focus point of each banner picture as CSS variables (default 50% 25%). A phone picture that is not set uses the computer one. */
function bannerFocus(hero: Hero): CSSProperties {
  const desktop = `${hero.focusX ?? 50}% ${hero.focusY ?? 25}%`;
  const phone = hero.photoPhone ? `${hero.phoneFocusX ?? 50}% ${hero.phoneFocusY ?? 25}%` : desktop;
  const w = hero.photoWidth && hero.photoHeight ? hero.photoWidth : TEXT_IMAGE_W;
  const h = hero.photoWidth && hero.photoHeight ? hero.photoHeight : TEXT_IMAGE_H;
  return { "--tkh-focus": desktop, "--tkh-focus-phone": phone, ...(hero.textInImage ? { "--tkh-ratio": `${w} / ${h}` } : {}) } as CSSProperties;
}

/** The heading of a section: eyebrow pill, H2, and an optional link on the right, aligned to the bottom. */
function SectionHead({
  id,
  eyebrow,
  tone,
  title,
  link,
}: {
  id: string;
  eyebrow: string;
  tone: "rose" | "lavender" | "peach";
  title: string;
  link?: { href: string; text: string };
}) {
  return (
    <div className="tkh-head" data-reveal>
      <div>
        <p className={`tkh-eyebrow tkh-eyebrow-${tone}`}>{eyebrow}</p>
        <h2 id={id} className="tkh-h2">
          {title}
        </h2>
      </div>
      {link ? (
        <Link className="tkh-more" href={link.href} prefetch={false}>
          {link.text}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * H7.4: the New design home page, as in the Home mockup and SPEC section 2. Every visible line comes from the
 * UI text store (keys in lib/ui/text.ts), the shell config (trust pills, How it works, category photos), the
 * page content (banner) or the catalogue. The code keeps only the defaults.
 */
export function NewHome({
  hero,
  categories,
  ads,
  shell,
  paths,
  countries,
  texts,
  categoriesCount = 4,
}: {
  hero: Hero;
  categories: Cat[];
  ads: ListingDoc[];
  shell: ShellConfig;
  paths: UrlPaths;
  countries: CountryPlaces[];
  texts: UiTextMap;
  categoriesCount?: number;
}) {
  const t = makeT(texts);
  const photos = new Map(shell.media.images.filter((image) => image.scope === "category" && image.photo).map((image) => [image.slug, { src: image.photo, focus: `${image.focusX ?? 50}% ${image.focusY ?? 18}%` }]));
  const cats = categories.filter((cat) => cat.slug && cat.name).slice(0, Math.min(8, Math.max(1, categoriesCount)));
  const categoryNames = new Map(categories.map((cat) => [cat.slug || "", cat.name || ""]));
  const shown = ads.slice(0, HOME_ADS_SHOWN);
  const city = commonCity(shown);
  // P1: "Latest ads in {city}", or "Latest ads in India" when no city is chosen.
  const adsTitle = t("home.ads.title", { city: city ? prettyPlace(city) : t("home.ads.defaultPlace") });
  const { lead, accent } = splitHeadline(hero.desktop);
  const localPhoto = hero.photo.startsWith("/");
  const inImage = hero.textInImage === true && Boolean(hero.photo);
  const bannerW = inImage && hero.photoWidth && hero.photoHeight ? hero.photoWidth : inImage ? TEXT_IMAGE_W : 1280;
  const bannerH = inImage && hero.photoWidth && hero.photoHeight ? hero.photoHeight : inImage ? TEXT_IMAGE_H : 420;
  const cardLabels = {
    online: t("home.ads.online"),
    watermark: t("home.ads.watermark"),
    photoPrev: t("home.ads.photoPrev"),
    photoNext: t("home.ads.photoNext"),
    chat: t("home.ads.chat"),
    viewAd: t("home.ads.viewAd"),
    age: t("home.ads.age"),
  };
  const searchLabels = {
    state: t("home.search.state"),
    city: t("home.search.city"),
    category: t("home.search.category"),
    allStates: t("home.search.allStates"),
    allCities: t("home.search.allCities"),
    allCategories: t("home.search.allCategories"),
    button: t("home.search.button"),
  };

  return (
    <div className="tkh-home">
      <section className="tkh-page" aria-label="Banner">
        <div className="tkh-banner" style={bannerFocus(hero)} data-text-in-image={inImage ? "true" : undefined} data-phone-photo={inImage && hero.photoPhone ? "true" : undefined}>
          {hero.photo && hero.photoPhone ? (
            <picture>
              <source media="(max-width: 599px)" srcSet={hero.photoPhone} />
              <img className="tkh-banner-img" src={hero.photo} alt={hero.photoAlt} width={bannerW} height={bannerH} fetchPriority="high" />
            </picture>
          ) : hero.photo ? (
            localPhoto ? (
              <Image className="tkh-banner-img" src={hero.photo} alt={hero.photoAlt} width={bannerW} height={bannerH} priority sizes="(max-width: 1280px) 100vw, 1280px" />
            ) : (
              <img className="tkh-banner-img" src={hero.photo} alt={hero.photoAlt} width={bannerW} height={bannerH} />
            )
          ) : (
            <span className="tkh-banner-img tkh-banner-empty" aria-hidden="true" />
          )}
          {inImage ? (
            <h1 className="tkh-sr">{hero.desktop}</h1>
          ) : (
            <div className="tkh-banner-copy m-enter">
              <h1>
                {lead ? `${lead} ` : ""}
                <span className="tkh-grad">{accent}</span>
              </h1>
              <p>{t("home.banner.sub")}</p>
            </div>
          )}
        </div>

        <HomeSearchForm
          paths={paths}
          labels={searchLabels}
          countries={countries}
          categories={categories.filter((cat) => cat.slug && cat.name).map((cat) => ({ slug: cat.slug || "", name: cat.name || "" }))}
        />

        <ul className="tkh-trust" tabIndex={0} aria-label="Why Tharkoo">
          {shell.home.trust.slice(0, 5).map((pill) => (
            <li key={pill.label}>
              <i aria-hidden="true" />
              {pill.label}
            </li>
          ))}
        </ul>
      </section>

      <section className="tkh-page tkh-section" aria-labelledby="home-cats">
        <SectionHead
          id="home-cats"
          eyebrow={t("home.cats.eyebrow")}
          tone="rose"
          title={t("home.cats.title")}
          link={{ href: applyPrefixes("/categories/", paths), text: t("home.cats.all") }}
        />
        <ul className="tkh-cats">
          {cats.map((cat) => {
            const slug = cat.slug || "";
            const photo = photos.get(slug);
            return (
              <li key={slug} data-reveal>
                <Link className="tkh-cat m-lift" href={applyPrefixes(categoryPath(slug), paths)} prefetch={false}>
                  {photo ? (
                    <img className="tkh-cat-photo" src={photo.src} alt="" width={480} height={320} loading="lazy" style={{ objectPosition: photo.focus }} />
                  ) : (
                    <span className="tkh-cat-photo tkh-cat-empty" aria-hidden="true" />
                  )}
                  <span className="tkh-cat-strip">
                    <span className="tkh-cat-text">
                      <span className="tkh-cat-name">{cat.name}</span>
                      <span className="tkh-cat-line">{blurbOf(cat)}</span>
                    </span>
                    <span className="tkh-cat-arrow" aria-hidden="true">
                      <ArrowRight size={16} />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <NewAdsGate enabledSlugs={countries.map((country) => country.slug)} postHref={postAdPath(paths)}>
      {shown.length ? (
        <HomeAdsSection
          id="home-fresh"
          eyebrow={t("home.ads.eyebrow")}
          title={adsTitle}
          listLabel={t("home.ads.list")}
          moreHref={applyPrefixes("/search/", paths)}
          moreText={t("home.ads.all")}
        >
          {shown.map((ad, position) => (
            <li key={ad.slug}>
              <HomeAdCard ad={homeAdCardData(ad, categoryNames, paths, t("card.fallbackTitle"))} labels={cardLabels} order={position} />
            </li>
          ))}
        </HomeAdsSection>
      ) : null}
      </NewAdsGate>

      <section className="tkh-page tkh-section" aria-labelledby="home-how">
        <SectionHead id="home-how" eyebrow={t("home.steps.eyebrow")} tone="rose" title={t("home.steps.title")} />
        <ol className="tkh-steps">
          {shell.home.steps.slice(0, 3).map((step, index) => (
            <li className="tkh-step" key={step.title}>
              <span className="tkh-step-n" aria-hidden="true">
                {index + 1}
              </span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
