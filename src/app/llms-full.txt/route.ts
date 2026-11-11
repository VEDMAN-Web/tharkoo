import { fallbackLanding } from "@/lib/seo/landing";
import { getCategories, getTopCities } from "@/lib/queries";

export const revalidate = 300;

export async function GET() {
  let blocks: string[] = ["# Tharkoo", "", "Short answers from public city pages. No account data is included."];
  try {
    const [categories, cities] = await Promise.all([getCategories(), getTopCities()]);
    for (const cat of categories.slice(0, 6)) {
      for (const city of cities.slice(0, 4)) {
        const copy = fallbackLanding({
          category: cat.name || cat.slug || "Classifieds",
          city: city.name || city.slug,
          count: 1,
          indexable: true,
          site: "Tharkoo",
        });
        blocks.push("", `## ${copy.h1}`, copy.intro);
      }
    }
  } catch {
    blocks = ["# Tharkoo", "", "Public guides are listed in /llms.txt."];
  }
  return new Response(blocks.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
