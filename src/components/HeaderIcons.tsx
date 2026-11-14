import { BookOpen, CircleHelp, Grid2X2, House, Info, Mail, MapPin, ShieldCheck, Tag, User } from "lucide-react";
import type { ShellIcon } from "@/server/site-links/shell-config-rules";

const GLYPHS: Record<ShellIcon, typeof House> = {
  home: House,
  grid: Grid2X2,
  pin: MapPin,
  book: BookOpen,
  help: CircleHelp,
  mail: Mail,
  info: Info,
  shield: ShieldCheck,
  user: User,
  tag: Tag,
};

/** H7.1: one line icon per menu row. Icons are decorative, the row text is the label. */
export function ShellGlyph({ icon, size = 20 }: { icon: ShellIcon; size?: number }) {
  const Glyph = GLYPHS[icon] ?? Tag;
  return <Glyph size={size} strokeWidth={2} aria-hidden="true" focusable="false" />;
}
