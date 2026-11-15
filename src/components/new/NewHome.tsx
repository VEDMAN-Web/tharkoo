import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ListingDoc } from "@/lib/models";
import { displayTitle, prettyPlace } from "@/lib/format";
import { listingPhotos, safePhoto } from "@/lib/media";
import { adPath, applyPrefixes, categoryPath, type UrlPaths } from "@/lib/urls";
import { makeT, type UiTextMap } from "@/lib/ui/text";
import type { HeroPlate } from "@/lib/ui/site-content";
import type { ShellConfig } from "@/server/site-links/shell-config-rules";
import { HomeAdCard } from "./HomeAdCard";
import { HomeSearchForm } from "./HomeSearchForm";
import { commonCity, splitHeadline, tierKeyOf } from "./home-copy";
import "./home-spec.css";

type Cat = { slug?: string; name?: string; homeBlurb?: string; description?: string };
type Hero = { photo: string; photoPhone?: string; photoAlt: string; desktop: string; searchPlaceholder: string; plate?: HeroPlate };
type Place = { slug: string; name: string };

const BLURB_MAX = 70;

function blurbOf(cat: Cat) {
  const text = (cat.homeBlurb || cat.description || "").replace(/\s+/g, " ").trim();
  return text.length > BLURB_MAX ? `${text.slice(0, BLURB_MAX - 1)}…` : text;
}

function placeOf(ad: ListingDoc) {
  const city = prettyPlace(ad.citySlug);
  const area = ad.place && ad.place !== city ? ad.place : "";
  return area ? `${city} / ${area}` : city;
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
    <div className="tkh-head">
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
  cities,
  texts,
}: {
  hero: Hero;
  categories: Cat[];
  ads: ListingDoc[];
  shell: ShellConfig;
  paths: UrlPaths;
  cities: Place[];
  texts: UiTextMap;
}) {
  const t = makeT(texts);
  const photos = new Map(shell.media.images.filter((image) => image.scope === "category" && image.photo).map((image) => [image.slug, image.photo]));
  const cats = categories.filter((cat) => cat.slug && cat.name).slice(0, 8);
  const categoryNames = new Map(categories.map((cat) => [cat.slug || "", cat.name || ""]));
  const shown = ads.slice(0, 4);
  const city = commonCity(shown);
  const adsTitle = city ? t("home.ads.title", { city: prettyPlace(city) }) : t("home.ads.titleAll");
  const { lead, accent } = splitHeadline(hero.desktop);
  const localPhoto = hero.photo.startsWith("/");
  const badgeLabel = (variant?: string) => {
    const key = tierKeyOf(variant);
    return key ? t(key) : "";
  };
  const cardLabels = {
    view: t("home.ads.view"),
    online: t("home.ads.online"),
    away: t("home.ads.away"),
    watermark: t("home.ads.watermark"),
    views: t("home.ads.views"),
  };
  const searchLabels = {
    keyword: t("home.search.keyword"),
    city: t("home.search.city"),
    category: t("home.search.category"),
    allCities: t("home.search.allCities"),
    allCategories: t("home.search.allCategories"),
    button: t("home.search.button"),
  };

  return (
    <div className="tkh-home">
      <div className="tkh-utility">
        {/* Focusable so a keyboard user can scroll the row sideways on a narrow screen. */}
        <ul className="tkh-utility-in" tabIndex={0}>
          <li className="tkh-util tkh-util-mint">
            <i aria-hidden="true" />
            {t("home.utility.online")}
          </li>
          <li className="tkh-util tkh-util-lavender">{t("home.utility.free")}</li>
          <li className="tkh-util tkh-util-peach">{t("home.utility.hours")}</li>
        </ul>
      </div>

      <section className="tkh-page" aria-label="Banner">
        <div className="tkh-banner" data-plate={hero.plate ?? "auto"}>
          {hero.photo && hero.photoPhone ? (
            <picture>
              <source media="(max-width: 599px)" srcSet={hero.photoPhone} />
              <img className="tkh-banner-img" src={hero.photo} alt={hero.photoAlt} width={1280} height={420} fetchPriority="high" />
            </picture>
          ) : hero.photo ? (
            localPhoto ? (
              <Image className="tkh-banner-img" src={hero.photo} alt={hero.photoAlt} width={1280} height={420} priority sizes="(max-width: 1280px) 100vw, 1280px" />
            ) : (
              <img className="tkh-banner-img" src={hero.photo} alt={hero.photoAlt} width={1280} height={420} />
            )
          ) : (
            <span className="tkh-banner-img tkh-banner-empty" aria-hidden="true" />
          )}
          <div className="tkh-banner-copy">
            <h1>
              {lead ? `${lead} ` : ""}
              <span className="tkh-grad">{accent}</span>
            </h1>
            <p>{t("home.banner.sub")}</p>
          </div>
        </div>

        <HomeSearchForm
          paths={paths}
          placeholder={hero.searchPlaceholder}
          labels={searchLabels}
          cities={cities}
          categories={categories.filter((cat) => cat.slug && cat.name).map((cat) => ({ slug: cat.slug || "", name: cat.name || "" }))}
        />

        <ul className="tkh-trust" aria-label="Why Tharkoo">
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
              <li key={slug}>
                <Link className="tkh-cat" href={applyPrefixes(categoryPath(slug), paths)} prefetch={false}>
                  {photo ? (
                    <img className="tkh-cat-photo" src={photo} alt="" width={480} height={320} loading="lazy" />
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

      {shown.length ? (
        <section className="tkh-page tkh-section" aria-labelledby="home-fresh">
          <SectionHead
            id="home-fresh"
            eyebrow={t("home.ads.eyebrow")}
            tone="lavender"
            title={adsTitle}
            link={{ href: applyPrefixes("/search/", paths), text: t("home.ads.all") }}
          />
          <div className="tkh-ads">
            {shown.map((ad) => {
              const photo = safePhoto(listingPhotos(ad.categorySlug, ad.publicId || ad.slug || "", ad.photos || [])[0]);
              return (
                <HomeAdCard
                  key={ad.slug}
                  ad={{
                    slug: ad.slug || "",
                    title: displayTitle(ad.title) || t("card.fallbackTitle"),
                    price: ad.price,
                    photo,
                    categoryName: categoryNames.get(ad.categorySlug || "") || prettyPlace(ad.categorySlug),
                    place: placeOf(ad),
                    href: adPath(paths, ad.slug || ""),
                  }}
                  badge={badgeLabel(ad.variant)}
                  labels={cardLabels}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="tkh-page tkh-section" aria-labelledby="home-how">
        <SectionHead id="home-how" eyebrow={t("home.steps.eyebrow")} tone="peach" title={t("home.steps.title")} />
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
