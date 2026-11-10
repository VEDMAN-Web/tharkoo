import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { HeroSearch } from "@/components/HeroSearch";
import { HomeBlocks, SkeletonGrid } from "@/components/HomeBlocks";
import { getHomepageContent } from "@/lib/queries";
import { pageMetadata } from "@/lib/ui/meta";

export const revalidate = 300;

export async function generateMetadata() {
  const content = await getHomepageContent();
  return pageMetadata({
    title: content.seoTitle,
    description: content.seoDescription,
    path: "/",
  });
}

export default async function Home() {
  const content = await getHomepageContent();
  const photo = content.hero.photo;
  const localPhoto = photo.startsWith("/");
  return (
    <>
      {localPhoto ? <link rel="preload" as="image" href={photo} fetchPriority="high" /> : null}
      <section className="tk-hero" data-tk="hero">
        {localPhoto ? (
          <Image className="tk-hero-photo" src={photo} alt="" width={960} height={880} priority sizes="42vw" />
        ) : (
          <img className="tk-hero-photo" src={photo} alt="" width={960} height={880} />
        )}
        <div className="tk-hero-copy">
          <h1>
            <span className="tk-hero-desk">{content.hero.desktop}</span>
            <span className="tk-hero-mob">
              {content.hero.mobileLines.map((line, index) => (
                <span key={line}>
                  {index ? <br /> : null}
                  {line}
                </span>
              ))}
            </span>
          </h1>
        </div>
        <HeroSearch label={content.hero.searchPlaceholder} />
      </section>
      <Link href="/u/post-insert/" data-tk="post-ad" className="tk-btn tk-btn-primary tk-home-post" prefetch={false}>
        {content.hero.postLabel}
      </Link>
      <Suspense fallback={<SkeletonGrid />}>
        <HomeBlocks />
      </Suspense>
    </>
  );
}
