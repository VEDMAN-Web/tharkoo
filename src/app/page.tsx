import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { HeroSearch } from "@/components/HeroSearch";
import { HomeBlocks, SkeletonGrid } from "@/components/HomeBlocks";
import { getHomepageContent } from "@/lib/queries";
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

export default async function Home() {
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
        </div>
        <HeroSearch label={content.hero.searchPlaceholder} />
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
