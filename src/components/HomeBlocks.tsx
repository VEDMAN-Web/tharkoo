import Link from "next/link";
import { CategoryIcon } from "./CategoryIcon";
import { safeHtml } from "@/lib/sanitize";

type Block = {
  id: string;
  type: string;
  enabled: boolean;
  title?: string;
  subtitle?: string;
  body?: string;
  html?: string;
  cta?: string;
  href?: string;
  cityCount?: number;
  moreLabel?: string;
};

type Cat = {
  slug?: string;
  name?: string;
  description?: string;
  color?: string;
  showOnHome?: boolean;
  homeBlurb?: string;
  homeCities?: string[];
  moreLabel?: string;
};

type City = { slug?: string; name?: string };

export function HomeBlocks({
  blocks,
  categories,
  cities,
}: {
  blocks: Block[];
  categories: Cat[];
  cities: City[];
}) {
  const visible = (blocks || []).filter((b) => b.enabled !== false);
  return (
    <div>
      {visible.map((block) => {
        if (block.type === "hero") {
          return (
            <header key={block.id} className="mb-6">
              <h1 className="text-[28px] font-normal leading-tight text-[#222] md:text-[34px]">{block.title}</h1>
              {block.subtitle ? <h2 className="mt-1 text-[18px] font-normal text-[#555]">{block.subtitle}</h2> : null}
            </header>
          );
        }
        if (block.type === "categories") {
          const count = block.cityCount || 3;
          const onHome = categories.filter((c) => c.showOnHome !== false);
          return (
            <div key={block.id} className="grid gap-8">
              {onHome.map((cat) => {
                const featured = (cat.homeCities?.length
                  ? cities.filter((c) => cat.homeCities!.includes(c.slug || ""))
                  : cities
                ).slice(0, count);
                return (
                  <section key={cat.slug} className="flex gap-4 border-b border-[#ddd] pb-6">
                    <CategoryIcon slug={cat.slug!} color={cat.color} name={cat.name!} />
                    <div className="min-w-0 flex-1">
                      <h2 className="text-[20px] font-bold">
                        <Link href={`/${cat.slug}/`} className="text-[#222] no-underline hover:underline">
                          {cat.name}
                        </Link>
                      </h2>
                      <p className="mt-1 text-[13px] leading-5 text-[#666]">{cat.homeBlurb || cat.description}</p>
                      <ul className="mt-2 text-[13px]">
                        {featured.map((city) => (
                          <li key={city.slug}>
                            <Link href={`/${cat.slug}/${city.slug}/`}>
                              {cat.name} {city.name}
                            </Link>
                          </li>
                        ))}
                        <li>
                          <Link href={`/${cat.slug}/`}>{cat.moreLabel || block.moreLabel || "More cities"}</Link>
                        </li>
                      </ul>
                    </div>
                  </section>
                );
              })}
            </div>
          );
        }
        if (block.type === "boost" || block.type === "banner") {
          return (
            <section key={block.id} className="panel mt-8">
              <h2 className="text-[18px] font-bold">{block.title}</h2>
              <p className="mt-2 text-[13px] text-[#555]">{block.body || block.subtitle}</p>
              {block.cta ? (
                <Link href={block.href || "/u/post-insert/"} className="btn-post mt-4 inline-block">
                  {block.cta}
                </Link>
              ) : null}
            </section>
          );
        }
        if (block.type === "html") {
          return (
            <div
              key={block.id}
              className="mt-8 text-[13px] leading-6 text-[#555]"
              dangerouslySetInnerHTML={{ __html: safeHtml(block.html || "") }}
            />
          );
        }
        if (block.type === "cities") {
          return (
            <section key={block.id} className="mt-8">
              <h2 className="text-[18px] font-bold">{block.title || "Cities"}</h2>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
                {cities.map((c) => (
                  <Link key={c.slug} href={`/call-girls/${c.slug}/`}>
                    {c.name}
                  </Link>
                ))}
              </div>
            </section>
          );
        }
        return null;
      })}
    </div>
  );
}
