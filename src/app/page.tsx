import { Suspense } from "react";
import { HomeAbove, HomeBelow, SkeletonGrid } from "@/components/HomeBlocks";
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
      <section className="relative overflow-hidden" style={{ background: "var(--grad-hero)" }}>
        <div className="mx-auto w-full max-w-[1200px] px-4 pt-12 md:px-6 lg:px-8 lg:pt-20">
          <h1 className="t-display max-w-[68ch]">Premium classifieds, across India.</h1>
          <p className="t-lead mt-4 max-w-[68ch] text-muted">Verified people. Trusted listings. In your city.</p>
        </div>
        <HomeAbove />
      </section>
      <Suspense fallback={<SkeletonGrid />}>
        <HomeBelow />
      </Suspense>
    </>
  );
}
