/**
 * H7.4c: the line icons a category can show when it has no photo. The admin picks one under Categories; a category
 * with no pick gets the default for its kind. Pure data plus lucide components, so the admin and the home page share it.
 */
import { Baby, Book, Briefcase, Building2, Calendar, Camera, Car, Dumbbell, GraduationCap, Gem, Heart, Hammer, House, Laptop, MapPin, Music, PawPrint, Plane, Shirt, ShoppingBag, Smartphone, Sofa, Sparkles, Stethoscope, Tag, Users, Utensils, Wrench, Bike, type LucideIcon } from "lucide-react";

export const CATEGORY_ICONS: readonly { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "shopping-bag", label: "Shopping bag (goods)", Icon: ShoppingBag },
  { key: "house", label: "House (property)", Icon: House },
  { key: "car", label: "Car (vehicles)", Icon: Car },
  { key: "briefcase", label: "Briefcase (jobs)", Icon: Briefcase },
  { key: "wrench", label: "Wrench (services)", Icon: Wrench },
  { key: "heart", label: "Heart (people)", Icon: Heart },
  { key: "graduation-cap", label: "Graduation cap (education)", Icon: GraduationCap },
  { key: "paw-print", label: "Paw print (pets)", Icon: PawPrint },
  { key: "users", label: "Group (friends, meetups)", Icon: Users },
  { key: "sparkles", label: "Sparkles (wellness, beauty)", Icon: Sparkles },
  { key: "smartphone", label: "Phone (gadgets)", Icon: Smartphone },
  { key: "laptop", label: "Laptop (computers)", Icon: Laptop },
  { key: "shirt", label: "Shirt (fashion)", Icon: Shirt },
  { key: "gem", label: "Gem (jewellery)", Icon: Gem },
  { key: "utensils", label: "Cutlery (food)", Icon: Utensils },
  { key: "dumbbell", label: "Dumbbell (fitness)", Icon: Dumbbell },
  { key: "bike", label: "Bicycle (sport)", Icon: Bike },
  { key: "music", label: "Music note", Icon: Music },
  { key: "camera", label: "Camera (photo, video)", Icon: Camera },
  { key: "plane", label: "Plane (travel)", Icon: Plane },
  { key: "stethoscope", label: "Stethoscope (health)", Icon: Stethoscope },
  { key: "building", label: "Building (business)", Icon: Building2 },
  { key: "sofa", label: "Sofa (furniture)", Icon: Sofa },
  { key: "baby", label: "Baby (kids)", Icon: Baby },
  { key: "hammer", label: "Hammer (tools, trades)", Icon: Hammer },
  { key: "book", label: "Book (books)", Icon: Book },
  { key: "calendar", label: "Calendar (events)", Icon: Calendar },
  { key: "map-pin", label: "Map pin (local)", Icon: MapPin },
  { key: "tag", label: "Tag (other)", Icon: Tag },
];

/** The default icon key for each category kind, used when a category has no pick of its own. */
export const DEFAULT_ICON_BY_KIND: Record<string, string> = {
  goods: "shopping-bag",
  property: "house",
  vehicle: "car",
  job: "briefcase",
  service: "wrench",
  people: "heart",
};

export function isCategoryIconKey(value: unknown): value is string {
  return typeof value === "string" && CATEGORY_ICONS.some((choice) => choice.key === value);
}

/** The icon key a category shows: its own pick when it is a known key, else the default for its kind, else a tag. */
export function categoryIconKey(icon: unknown, kind: unknown): string {
  if (isCategoryIconKey(icon)) return icon;
  return (typeof kind === "string" && DEFAULT_ICON_BY_KIND[kind]) || "tag";
}

/** The lucide component for a category's icon. */
export function categoryIconFor(icon: unknown, kind: unknown): LucideIcon {
  const key = categoryIconKey(icon, kind);
  return CATEGORY_ICONS.find((choice) => choice.key === key)?.Icon ?? Tag;
}
