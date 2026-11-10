const PHOTOS: Record<string, string> = {
  dating: "/placeholders/p1.jpg",
  friendship: "/placeholders/p2.jpg",
  meetups: "/placeholders/p3.jpg",
  personal: "/placeholders/p4.jpg",
  jobs: "/placeholders/p5.jpg",
  wellness: "/placeholders/p6.jpg",
  property: "/placeholders/p7.jpg",
  vehicles: "/placeholders/p8.jpg",
  "buy-and-sell": "/placeholders/p1.jpg",
  pets: "/placeholders/p2.jpg",
  education: "/placeholders/p3.jpg",
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
