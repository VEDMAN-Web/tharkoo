import type { ListingDoc } from "@/lib/models";
import { makeT, type UiTextMap } from "@/lib/ui/text";
import type { UrlPaths } from "@/lib/urls";
import type { ShellConfig } from "@/server/site-links/shell-config-rules";
import type { CountryPlaces } from "@/server/locations/site-country";
import { HomeSearchForm } from "./HomeSearchForm";
import { HomeAds } from "./home-blocks/Ads";
import { HomeBanner } from "./home-blocks/Banner";
import { HomeCategories, pickCategories } from "./home-blocks/Categories";
import { HomeSteps } from "./home-blocks/Steps";
import { HomeTrust } from "./home-blocks/Trust";
import { cardLabelsOf, searchLabelsOf } from "./home-blocks/labels";
import type { Cat, Hero } from "./home-blocks/types";
import "./home-spec.css";

/**
 * H7.4: the New design home page, as in the Home mockup and SPEC section 2. Every visible line comes from the
 * UI text store (keys in lib/ui/text.ts), the shell config (trust pills, How it works, category photos), the
 * page content (banner) or the catalogue. The code keeps only the defaults. The sections are the components in
 * home-blocks, which HomeBlocksV2 also renders from a layout.
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
  return (
    <div className="tkh-home">
      <section className="tkh-page" aria-label="Banner">
        <HomeBanner hero={hero} sub={t("home.banner.sub")} />
        <HomeSearchForm
          paths={paths}
          labels={searchLabelsOf(t)}
          countries={countries}
          categories={categories.filter((cat) => cat.slug && cat.name).map((cat) => ({ slug: cat.slug || "", name: cat.name || "" }))}
        />
        <HomeTrust pills={shell.home.trust} />
      </section>
      <HomeCategories
        eyebrow={t("home.cats.eyebrow")}
        title={t("home.cats.title")}
        allText={t("home.cats.all")}
        cats={pickCategories(categories, categoriesCount)}
        shell={shell}
        paths={paths}
      />
      <HomeAds
        eyebrow={t("home.ads.eyebrow")}
        titleTemplate={t("home.ads.title", { city: "{city}" })}
        defaultPlace={t("home.ads.defaultPlace")}
        listLabel={t("home.ads.list")}
        moreText={t("home.ads.all")}
        fallbackTitle={t("card.fallbackTitle")}
        labels={cardLabelsOf(t)}
        ads={ads}
        categories={categories}
        countries={countries}
        paths={paths}
      />
      <HomeSteps eyebrow={t("home.steps.eyebrow")} title={t("home.steps.title")} steps={shell.home.steps} />
    </div>
  );
}
