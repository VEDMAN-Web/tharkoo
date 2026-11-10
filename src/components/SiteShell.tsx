import { getCategories, getCities, getSite, getTopCities } from "@/lib/queries";
import { PathChrome } from "./PathChrome";

export async function loadShell() {
  const [site, categories, topCities, cities] = await Promise.all([getSite(), getCategories(), getTopCities(), getCities()]);
  return { site, categories, topCities, cities, user: null as { email: string; roles: string[] } | null };
}

export function SiteShell({
  children,
  shell,
}: {
  children: React.ReactNode;
  shell: Awaited<ReturnType<typeof loadShell>>;
  pathname?: string;
  admin?: boolean;
}) {
  return <PathChrome shell={shell}>{children}</PathChrome>;
}
