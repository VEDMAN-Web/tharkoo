"use server";

import { subcategoriesByCategory } from "@/server/categories/public";

export type PostSubcategory = { id: string; name: string };

/** The visible sub-categories of every category, for the post-ad form. Public data, no sign-in needed. */
export async function loadPostSubcategories(): Promise<Record<string, PostSubcategory[]>> {
  const all = await subcategoriesByCategory();
  return Object.fromEntries(Object.entries(all).map(([categoryId, subs]) => [categoryId, subs.map((sub) => ({ id: sub.id, name: sub.name }))]));
}
