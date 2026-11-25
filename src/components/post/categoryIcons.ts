import { Anchor, Bell, Briefcase, CalendarDays, Car, Cloud, Coffee, Compass, Feather, Flower2, Gift, Globe, GraduationCap, Heart, House, Leaf, MessageCircleHeart, Moon, Mountain, Palette, PawPrint, Puzzle, Rainbow, Rocket, ShoppingBag, Sparkles, Star, Sun, Tag, Ticket, Umbrella, Users, type LucideIcon } from "lucide-react";
import { CATEGORY_ICONS } from "@/lib/category-icons";

/** The icon for a category slug the site ships with. */
const BY_SLUG: Record<string, LucideIcon> = {
  dating: Heart,
  friendship: Users,
  meetups: CalendarDays,
  "personal-ads": MessageCircleHeart,
  jobs: Briefcase,
  wellness: Sparkles,
  property: House,
  vehicles: Car,
  "buy-and-sell": ShoppingBag,
  pets: PawPrint,
  education: GraduationCap,
};

/** For categories made in the admin: a word in the slug picks the icon. */
const BY_WORD: readonly [RegExp, LucideIcon][] = [
  [/spa|salon|beauty|massage/, Flower2],
  [/lgbt|pride|queer|rainbow/, Rainbow],
  [/event|party|ticket/, Ticket],
  [/travel|tour|trip/, Compass],
  [/food|dining|cafe/, Coffee],
  [/art|craft|design/, Palette],
];

/** Used when nothing above gives an icon that is still free. */
const SPARE: readonly LucideIcon[] = [Star, Gift, Compass, Sun, Moon, Coffee, Palette, Ticket, Bell, Cloud, Leaf, Globe, Rocket, Umbrella, Anchor, Feather, Mountain, Puzzle, Flower2, Rainbow, Tag];

/** The admin's own pick for a category. "tag" is the "nothing chosen" icon, so it does not count. */
function adminIcon(key: string | undefined): LucideIcon | null {
  if (!key || key === "tag") return null;
  return CATEGORY_ICONS.find((choice) => choice.key === key)?.Icon ?? null;
}

/**
 * H21.12c: one icon for each category of step 1, and no two the same. The admin's icon comes first; without one, the slug's own icon,
 * then a word in the slug; when that is already taken, the next spare icon.
 */
export function categoryIconsFor(categories: readonly { slug: string; icon?: string }[]): LucideIcon[] {
  const used = new Set<LucideIcon>();
  const out: (LucideIcon | null)[] = categories.map(() => null);
  const take = (index: number, icon: LucideIcon | null | undefined) => {
    if (out[index] || !icon || used.has(icon)) return;
    out[index] = icon;
    used.add(icon);
  };
  // Every admin pick is placed before any fallback, so a fallback never takes an icon a later category was given.
  categories.forEach((category, index) => take(index, adminIcon(category.icon)));
  categories.forEach((category, index) => take(index, BY_SLUG[category.slug]));
  categories.forEach((category, index) => take(index, BY_WORD.find(([word]) => word.test(category.slug))?.[1]));
  categories.forEach((_, index) => take(index, SPARE.find((icon) => !used.has(icon))));
  return out.map((icon) => icon ?? Tag);
}

/** The icon of one slug on its own. Step 1 uses categoryIconsFor, which keeps them all different. */
export function categoryIcon(slug: string): LucideIcon {
  return BY_SLUG[slug] ?? Tag;
}
