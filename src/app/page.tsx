import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { HeroSearch } from "@/components/HeroSearch";
import { HomeLayout } from "@/components/blocks/HomeLayout";
import { HomeBlocks, SkeletonGrid } from "@/components/HomeBlocks";
import { getCategories, getHomeAds, getHomepageContent, getSite } from "@/lib/queries";
import { JsonLd } from "@/lib/jsonld";
import { canonical } from "@/lib/seo";
import { homeSiteNodes } from "@/lib/seo/home-blog";
import { siteOrganizationNode } from "@/lib/seo-site";
import { getPageBlocks } from "@/lib/layout/read";
import { postAdPath, searchPath } from "@/lib/urls";
import { textOverrides } from "@/app/admin/ui-text/store";
import { pickTexts } from "@/lib/ui/text";
import { UiTextProvider } from "@/components/ui/AdCard";
import { pageMetadata } from "@/lib/ui/meta";
import { getPaths } from "@/server/urls/service";
import { plain } from "@/lib/plain";
import { newDesignOn } from "@/server/site-links/new-design";
import { readShellConfig } from "@/server/site-links/shell-config";
import { NewHome } from "@/components/new/NewHome";
import { countryPlaces } from "@/server/locations/site-country";

export const revalidate = 60;

export async function generateMetadata() {
  const content = await getHomepageContent();
  return pageMetadata({
    title: content.seoTitle,
    description: content.seoDescription,
    path: "/",
  });
}

/** The published home layout, or null when there is none (or it cannot be read), so the built-in page below is shown. */
async function publishedHome() {
  try {
    return await getPageBlocks("home", ["default"]);
  } catch (error) {
    console.error("home layout could not be read, showing the built-in page", error);
    return null;
  }
}

/** H7.4: the New design home, as in the Home mockup. Used only while the New design switch is on. */
async function newHome(texts: ReturnType<typeof pickTexts>) {
  const [content, paths, categories, countries, feed, shell, site] = await Promise.all([
    getHomepageContent(),
    getPaths(),
    getCategories(),
    countryPlaces(),
    getHomeAds(),
    readShellConfig(),
    getSite(),
  ]);
  return (
    <UiTextProvider texts={texts}>
      <JsonLd
        data={homeSiteNodes(
          await siteOrganizationNode(site.name || "Tharkoo", {
            logo: canonical("/brand/logo-mark-512.png"),
            sameAs: content.socials.map((item) => item.href),
          }),
          site.name || "Tharkoo",
          searchPath(paths),
        )}
      />
      <NewHome
        hero={plain(content.hero)}
        categories={plain(categories)}
        ads={plain(feed)}
        shell={shell}
        paths={paths}
        countries={plain(countries)}
        texts={texts}
        categoriesCount={content.homeCategoriesCount}
      />
    </UiTextProvider>
  );
}

export default async function Home() {
  const [overrides, newDesign] = await Promise.all([textOverrides(), newDesignOn()]);
  const texts = pickTexts(overrides, "card.", "home.");
  if (newDesign) return newHome(texts);
  const blocks = await publishedHome();
  if (blocks) {
    return (
      <UiTextProvider texts={texts}>
        <HomeLayout blocks={blocks} />
      </UiTextProvider>
    );
  }
  const [content, paths] = await Promise.all([getHomepageContent(), getPaths()]);
  const photo = content.hero.photo;
  const localPhoto = photo.startsWith("/");
  return (
    <UiTextProvider texts={texts}>
      <section className="tk-hero" data-tk="hero">
        {localPhoto ? (
          <Image className="tk-hero-photo" src={photo} alt={content.hero.photoAlt} width={960} height={880} priority sizes="42vw" />
        ) : (
          <img className="tk-hero-photo" src={photo} alt={content.hero.photoAlt} width={960} height={880} />
        )}
        <div className="tk-hero-copy">
          <h1>{content.hero.desktop}</h1>
          <HeroSearch label={content.hero.searchPlaceholder} />
        </div>
      </section>
      <Link href={postAdPath(paths)} data-tk="post-ad" className="tk-btn tk-btn-primary tk-home-post" prefetch={false}>
        {content.hero.postLabel}
      </Link>
      <Suspense fallback={<SkeletonGrid />}>
        <HomeBlocks />
      </Suspense>
    </UiTextProvider>
  );
}
