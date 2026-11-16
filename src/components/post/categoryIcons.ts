import { Briefcase, CalendarDays, Car, GraduationCap, Heart, House, MessageCircleHeart, PawPrint, ShoppingBag, Sparkles, Tag, Users, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
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

export function categoryIcon(slug: string): LucideIcon {
  return ICONS[slug] ?? Tag;
}
