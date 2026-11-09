const LETTER: Record<string, string> = {
  "call-girls": "♡",
  massages: "✦",
  "male-escorts": "♂",
  transsexual: "⚥",
  "adult-meetings": "●",
};

export function CategoryIcon({
  slug,
  color,
  name,
}: {
  slug: string;
  color?: string;
  name: string;
}) {
  return (
    <div className="cat-icon" style={{ background: color || "#e20044" }} aria-hidden>
      {LETTER[slug] || name.slice(0, 1)}
    </div>
  );
}
