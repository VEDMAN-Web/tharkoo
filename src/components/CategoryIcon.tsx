const PHOTOS: Record<string, string> = {
  "call-girls": "/placeholders/p1.jpg",
  massages: "/placeholders/p2.jpg",
  "male-escorts": "/placeholders/p3.jpg",
  transsexual: "/placeholders/p4.jpg",
  "adult-meetings": "/placeholders/p5.jpg",
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
  const src = PHOTOS[slug] || "/placeholders/p1.jpg";
  return (
    <div className="cat-icon" style={{ boxShadow: `0 0 0 3px ${color || "#e20044"}` }} aria-label={name}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" />
    </div>
  );
}
