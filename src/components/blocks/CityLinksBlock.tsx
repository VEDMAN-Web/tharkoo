import Link from "next/link";
import { getCities, getTopCities } from "@/lib/queries";
import { placePath, searchPath } from "@/lib/urls";
import { getPaths } from "@/server/urls/service";

interface Props {
  title?: string;
  mode?: "top" | "manual";
  citySlugs?: string[];
  categorySlug?: string;
  max?: number;
}

/** A row of city links: the top cities, or the cities an editor picked. With a category set each links to that category's city hub; otherwise to a search for the city. */
export async function CityLinksBlock({ title, mode = "top", citySlugs = [], categorySlug, max = 12 }: Props) {
  const [all, top, paths] = await Promise.all([getCities(), getTopCities(), getPaths()]);
  const bySlug = new Map(all.map((city) => [city.slug, city]));
  const list = (mode === "manual" ? citySlugs.map((slug) => bySlug.get(slug)).filter(Boolean) : top).slice(0, max);
  if (!list.length) return null;
  return (
    <section className="tk-block tk-container">
      {title ? <h2>{title}</h2> : null}
      <div className="tk-city-pills">
        {list.map((city) => (
          <Link key={city!.slug} href={categorySlug ? placePath(categorySlug, city!.slug || "") : `${searchPath(paths)}?q=${encodeURIComponent(city!.name || "")}`} className="tk-city-row" prefetch={false}>
            {city!.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
