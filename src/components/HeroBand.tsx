import Link from "next/link";
import { PlaceholderArt } from "./ui/PlaceholderArt";

type Cat = { slug: string; name: string };
type City = { slug: string; name: string };

export function HeroBand({
  categories,
  cities,
}: {
  brand?: string;
  placeholder?: string;
  categories: Cat[];
  cities: City[];
}) {
  return (
    <div>
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-8 px-4 py-8 md:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:pb-20">
        <div className="max-w-[68ch]">
          <form action="/search/" method="get" className="grid gap-2 rounded-xl border border-line bg-surface p-2 sm:grid-cols-[1fr_1fr_auto]">
            <select name="category" aria-label="Category" className="h-14 rounded-md bg-bg px-3 text-base">
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat.slug} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
            <select name="city" aria-label="City" className="h-14 rounded-md bg-bg px-3 text-base">
              <option value="">All India</option>
              {cities.map((city) => (
                <option key={city.slug} value={city.slug}>
                  {city.name}
                </option>
              ))}
            </select>
            <button className="gold-btn h-14" type="submit">
              Search
            </button>
          </form>
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {categories.slice(0, 6).map((cat) => (
              <Link key={cat.slug} href={`/${cat.slug}/`} prefetch={false} className="inline-flex h-9 shrink-0 items-center rounded-pill border border-line px-3 t-small">
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
        <div className="hidden h-[420px] lg:block" aria-hidden>
          <PlaceholderArt seed="home-hero" category="generic" decorative />
        </div>
      </div>
    </div>
  );
}
