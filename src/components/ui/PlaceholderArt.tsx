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
  ["#A63A5E", "#6A2150", "#E0A08A"],
  ["#E9C27A", "#A63A5E", "#F7EEF3"],
  ["#6A2150", "#C9967E", "#FAEFF2"],
  ["#B8486B", "#6A2150", "#E0A08A"],
  ["#C9967E", "#A63A5E", "#F3EDE6"],
  ["#7B2D5E", "#E0A08A", "#F7EEF3"],
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
      className={cn("relative h-full w-full bg-[var(--letterbox)]", className)}
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
            <circle cx="1" cy="1" r="0.6" fill="#6A2150" opacity="0.08" />
          </pattern>
        </defs>
        <rect width="800" height="1000" fill="#F3EDE6" />
        {spots.map((spot, i) => (
          <ellipse key={i} cx={spot.cx * 8} cy={spot.cy * 10} rx={spot.r * 4} ry={spot.r * 5} fill={`url(#g-${n}-${i})`} />
        ))}
        <rect width="800" height="1000" fill={`url(#grain-${n})`} />
      </svg>
      <Icon className="tk-icon-lg absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-[var(--primary)] opacity-70" strokeWidth={1.5} aria-hidden />
    </div>
  );
}
