import { getCategories } from "@/lib/queries";
import { categoriesPath, citiesPath, DEFAULT_PATHS, safetyPath } from "@/lib/urls";
import { getPaths } from "@/server/urls/service";

export const revalidate = 300;

export async function GET() {
  let categories: { slug?: string; name?: string }[] = [];
  let cities = citiesPath(DEFAULT_PATHS);
  try {
    const paths = await getPaths();
    cities = citiesPath(paths);
    categories = await getCategories();
  } catch {
    categories = [];
  }
  const lines = [
    "# Tharkoo",
    "",
    "Tharkoo is a free classifieds site for India. People post dating notes, friendship notes, jobs, homes, vehicles, and local services. Contact stays on the ad.",
    "",
    "## Public pages",
    `- Home: /`,
    `- Categories: ${categoriesPath()}`,
    `- Cities: ${cities}`,
    `- Safety: ${safetyPath()}`,
    "- How it works: /how-it-works/",
    "- Prohibited items: /prohibited-items/",
    "- Terms: /terms/",
    "- Privacy: /privacy/",
    "",
    "## Categories",
    ...categories.filter((cat) => cat.slug).map((cat) => `- ${cat.name}: /${cat.slug}/`),
    "",
    "Account pages and the admin tools are not public guides.",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
