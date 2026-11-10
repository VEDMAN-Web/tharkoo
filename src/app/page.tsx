import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { HeroSearch } from "@/components/HeroSearch";
import { HomeBlocks, SkeletonGrid } from "@/components/HomeBlocks";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Classifieds across India | Tharkoo",
  description: "Browse listings for dating, friendship, meetups, wellness, and more in your city.",
  path: "/",
});

export default function Home() {
  return (
    <>
      <link rel="preload" as="image" href="/placeholders/hero.webp" fetchPriority="high" />
      <section className="tk-hero" data-tk="hero">
        <Image
          className="tk-hero-photo"
          src="/placeholders/hero.webp"
          alt=""
          width={960}
          height={880}
          priority
          sizes="42vw"
        />
        <div className="tk-hero-copy">
          <h1>
            <span className="tk-hero-desk">Single? Taken? Doesn&apos;t matter, Tharkoo is for everyone</span>
            <span className="tk-hero-mob">
              Single? Taken?
              <br />
              Doesn&apos;t matter,
              <br />
              Tharkoo is
              <br />
              for everyone
            </span>
          </h1>
        </div>
        <HeroSearch />
      </section>
      <Link href="/u/post-insert/" data-tk="post-ad" className="tk-btn tk-btn-primary tk-home-post" prefetch={false}>
        POST YOUR AD
      </Link>
      <Suspense fallback={<SkeletonGrid />}>
        <HomeBlocks />
      </Suspense>
    </>
  );
}
