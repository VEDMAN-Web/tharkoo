import { Suspense } from "react";
import Image from "next/image";
import { HeroCity } from "@/components/HeroCity";
import { HeroStats, HomeAbove, HomeBelow, SkeletonGrid } from "@/components/HomeBlocks";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Premium classifieds across India | Tharkoo",
  description: "Verified people. Trusted listings. Browse jobs, homes, vehicles, pets, and local services in your city.",
  path: "/",
});

export default function Home() {
  return (
    <>
      <link rel="preload" as="image" href="/placeholders/hero.webp" fetchPriority="high" />
      <section className="border-b border-line">
        <div className="mx-auto grid w-full max-w-[1200px] items-center gap-8 px-4 py-8 md:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-12">
          <div className="min-w-0">
            <h1 className="t-display max-w-[18ch]">Premium classifieds, across India.</h1>
            <p className="t-lead mt-3 max-w-[40ch] text-muted">Verified people. Trusted listings. In your city.</p>
            <form action="/search/" method="get" className="mt-6 grid gap-2 rounded-xl border border-line bg-surface p-2 sm:grid-cols-[1fr_auto]">
              <input
                name="q"
                aria-label="Search"
                placeholder="Search jobs, homes, cars, pets..."
                className="h-14 min-w-0 rounded-md bg-bg px-4 text-base"
              />
              <button className="gold-btn h-14 whitespace-nowrap px-6" type="submit">
                Search
              </button>
            </form>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <HeroCity />
              <Suspense fallback={<p className="t-small text-muted">Listings across India</p>}>
                <HeroStats />
              </Suspense>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-line">
            <Image
              src="/placeholders/hero.webp"
              alt="Dusk skyline above the water"
              width={800}
              height={600}
              priority
              decoding="sync"
              sizes="(min-width: 1024px) 480px, 100vw"
              className="h-auto w-full"
            />
          </div>
        </div>
      </section>
      <Suspense fallback={<SkeletonGrid />}>
        <HomeAbove />
      </Suspense>
      <Suspense fallback={<SkeletonGrid />}>
        <HomeBelow />
      </Suspense>
    </>
  );
}
