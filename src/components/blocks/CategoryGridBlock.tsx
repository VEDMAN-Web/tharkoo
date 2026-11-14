import Link from "next/link";
import { CalendarDays, Heart, Leaf, MessageSquareHeart, Sparkles, Users, type LucideIcon } from "lucide-react";
import { SmartImage } from "@/components/ui/SmartImage";
import { CARD_SIZES, type CardFocus } from "@/lib/layout/cards";
import { getCategories, getCities, listingCountsByCategoryCity } from "@/lib/queries";
import { safeHref } from "@/lib/sanitize";
import { cardFallback } from "@/lib/ui/site-content";
import { categoryPath, placePath } from "@/lib/urls";

const ICONS: Record<string, LucideIcon> = {
  dating: Heart,
  wellness: Leaf,
  friendship: Users,
  meetups: CalendarDays,
  "personal-ads": MessageSquareHeart,
};

interface Item {
  categorySlug: string;
  label?: string;
  blurb?: string;
  citySlugs?: string[];
  image?: { src: string; alt: string } | null;
  /** Which part of the photo stays in view when the frame crops it (H6.13). Centre when unset. */
  focus?: CardFocus;
}

interface Props {
  title?: string;
  intro?: string;
  items?: Item[];
  columnsDesktop?: number;
  showCounts?: boolean;
}

type Cat = { slug?: string; name?: string; homeBlurb?: string; description?: string; homeCities?: string[] };

/** Category cards with city pills. Same markup as the built-in home page so the page looks the same. */
export async function CategoryGridBlock({ title, intro, items = [], columnsDesktop = 3, showCounts = false }: Props) {
  const [categories, cities, counts] = await Promise.all([getCategories(), getCities(), listingCountsByCategoryCity().catch(() => [])]);
  const bySlug = new Map(categories.map((cat) => [cat.slug, cat as Cat]));
  const cityBySlug = new Map(cities.map((city) => [city.slug, city]));
  const top = cities.filter((city) => city.isTop).slice(0, 5);
  const liveKeys = new Set(counts.filter((row) => row.n > 0).map((row) => `${row._id.categorySlug}|${row._id.citySlug}`));
  const perCategory = new Map<string, number>();
  for (const row of counts) perCategory.set(row._id.categorySlug, (perCategory.get(row._id.categorySlug) ?? 0) + row.n);
  const cards = items.filter((item) => bySlug.has(item.categorySlug));

  function picksFor(item: Item, cat: Cat) {
    const chosen = (item.citySlugs ?? []).map((slug) => cityBySlug.get(slug)).filter(Boolean);
    if (chosen.length) return chosen;
    const homes = (cat.homeCities || []).map((slug) => cityBySlug.get(slug)).filter(Boolean).slice(0, 3);
    const list = homes.length ? homes : top.slice(0, 3);
    if (!liveKeys.size) return list;
    const filtered = list.filter((city) => liveKeys.has(`${item.categorySlug}|${city!.slug}`));
    return filtered.length ? filtered : list;
  }

  return (
    <>
      {title || intro ? (
        <div className="tk-home-head tk-container">
          {title ? <h2>{title}</h2> : null}
          {intro ? <p>{intro}</p> : null}
        </div>
      ) : null}
      <div className="tk-container tk-home-grid" data-cols={columnsDesktop}>
        {cards.map((item) => {
          const cat = bySlug.get(item.categorySlug)!;
          const Icon = ICONS[item.categorySlug] || Sparkles;
          const cardTitle = item.label || cat.name;
          const picks = picksFor(item, cat);
          const photo = item.image ? safeHref(item.image.src) : "";
          return (
            <article key={item.categorySlug} className="tk-home-card" data-tk="home-card">
              <Link href={categoryPath(cat.slug || "")} className="tk-home-photo" data-focus={item.focus ?? "center"} prefetch={false}>
                <SmartImage
                  src={photo || `/placeholders/${cat.slug}/01.webp`}
                  alt={item.image?.alt || `${cardTitle || "Category"} classifieds`}
                  seed={cat.slug || "cat"}
                  category={cat.slug}
                  width={600}
                  height={402}
                  sizes={CARD_SIZES}
                />
                <span className="tk-home-shade" />
                <span className="tk-home-title">
                  <Icon size={20} /> {cardTitle}
                </span>
              </Link>
              <div className="tk-home-body">
                <p>{item.blurb || cat.homeBlurb || cat.description || cardFallback(item.categorySlug)}</p>
                {showCounts ? <p className="tk-home-count">{perCategory.get(item.categorySlug) ?? 0} ads</p> : null}
                <div className="tk-city-pills">
                  {picks.map((city) => (
                    <Link key={city!.slug} href={placePath(cat.slug || "", city!.slug || "")} className="tk-city-row" prefetch={false}>
                      {city!.name}
                    </Link>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
