import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { HeroSearch } from "@/components/HeroSearch";
import { HomeLayout } from "@/components/blocks/HomeLayout";
import { HomeBlocks, SkeletonGrid } from "@/components/HomeBlocks";
import { getHomepageContent } from "@/lib/queries";
import { getPageBlocks } from "@/lib/layout/read";
import { postAdPath } from "@/lib/urls";
import { pageMetadata } from "@/lib/ui/meta";
import { getPaths } from "@/server/urls/service";

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

export default async function Home() {
  const blocks = await publishedHome();
  if (blocks) return <HomeLayout blocks={blocks} />;
  const [content, paths] = await Promise.all([getHomepageContent(), getPaths()]);
  const photo = content.hero.photo;
  const localPhoto = photo.startsWith("/");
  return (
    <>
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
    </>
  );
}
