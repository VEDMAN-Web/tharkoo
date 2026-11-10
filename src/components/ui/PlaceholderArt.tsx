import {
  Briefcase,
  CalendarDays,
  Car,
  GraduationCap,
  Heart,
  Home,
  Leaf,
  PawPrint,
  ShoppingBag,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  jobs: Briefcase,
  property: Home,
  vehicles: Car,
  pets: PawPrint,
  education: GraduationCap,
  wellness: Leaf,
  "buy-and-sell": ShoppingBag,
  friendship: Users,
  meetups: CalendarDays,
  dating: Heart,
  generic: Sparkles,
};

const PALETTES = [
  ["#C9A96E", "#8C5A4A", "#1F4A4A"],
  ["#E8D3A6", "#3B3558", "#1F4A4A"],
  ["#8A6D3B", "#8C5A4A", "#3B3558"],
  ["#C9A96E", "#1F4A4A", "#3B3558"],
  ["#D9BE88", "#8C5A4A", "#1F4A4A"],
  ["#C9A96E", "#3B3558", "#8A6D3B"],
];

function hash(seed: string) {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 33 + seed.charCodeAt(i)) >>> 0;
  return n;
}

export function PlaceholderArt({
  seed,
  category,
  className,
  label,
  decorative = false,
}: {
  seed: string;
  category?: string;
  className?: string;
  label?: string;
  decorative?: boolean;
}) {
  const n = hash(seed || category || "generic");
  const colors = PALETTES[n % PALETTES.length];
  const Icon = ICONS[category || ""] || Sparkles;
  const spots = [
    { cx: 20 + (n % 30), cy: 18 + (n % 20), r: 42 },
    { cx: 70 + ((n >> 3) % 20), cy: 62, r: 48 },
    { cx: 40, cy: 80 - ((n >> 5) % 15), r: 36 },
  ];
  return (
    <div
      className={cn("relative h-full w-full bg-[var(--surface)]", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label ?? "Photo coming soon"}
      aria-hidden={decorative || undefined}
    >
      <svg viewBox="0 0 800 1000" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          {spots.map((spot, i) => (
            <radialGradient id={`g-${n}-${i}`} key={i} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={colors[i % colors.length]} stopOpacity="0.9" />
              <stop offset="100%" stopColor={colors[i % colors.length]} stopOpacity="0" />
            </radialGradient>
          ))}
          <pattern id={`grain-${n}`} width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.6" fill="#F4F1EA" opacity="0.08" />
          </pattern>
        </defs>
        <rect width="800" height="1000" fill="#16161C" />
        {spots.map((spot, i) => (
          <ellipse key={i} cx={spot.cx * 8} cy={spot.cy * 10} rx={spot.r * 4} ry={spot.r * 5} fill={`url(#g-${n}-${i})`} />
        ))}
        <rect width="800" height="1000" fill={`url(#grain-${n})`} />
      </svg>
      <Icon className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-[var(--text)] opacity-55" strokeWidth={1.5} aria-hidden />
    </div>
  );
}
