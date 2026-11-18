import { connectDb } from "@/lib/db";
import { categoryIconKey, isCategoryIconKey } from "@/lib/category-icons";
import { effectiveKind } from "@/server/categories/kinds";
import { CategoryKindDef } from "@/server/models";

type IconCategory = { slug?: string; kind?: string; icon?: string; fields?: unknown };

/**
 * The icon a category shows when it has no photo: the pick made under "Icon when there is no photo" in Categories and
 * fields, else the icon of its Kind, else the built-in default for that Kind, else a tag. Returns the same rows with
 * `icon` set to a valid icon key, so a tile never has to guess.
 */
export async function withCategoryIcons<T extends IconCategory>(categories: readonly T[]): Promise<(T & { icon: string })[]> {
  await connectDb();
  const kinds = await CategoryKindDef.find({ removed: { $ne: true } })
    .select({ key: 1, icon: 1 })
    .lean<{ key: string; icon?: string }[]>();
  const kindIcon = new Map(kinds.map((kind) => [kind.key, kind.icon ?? ""]));
  return categories.map((category) => {
    const kind = effectiveKind(category);
    const fromKind = kindIcon.get(kind);
    const icon = isCategoryIconKey(category.icon) ? category.icon : isCategoryIconKey(fromKind) ? fromKind : categoryIconKey("", kind);
    return { ...category, icon };
  });
}
