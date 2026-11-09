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
    <div className="cat-icon" style={{ background: color || "#e20044" }} aria-label={name}>
      <svg viewBox="0 0 64 64" width="40" height="40" aria-hidden>
        {slug === "call-girls" ? (
          <>
            <circle cx="32" cy="20" r="10" fill="#fff" />
            <path d="M16 54c2-14 10-20 16-20s14 6 16 20" fill="#fff" />
          </>
        ) : slug === "massages" ? (
          <>
            <rect x="10" y="34" width="44" height="10" rx="5" fill="#fff" />
            <circle cx="24" cy="22" r="7" fill="#fff" />
            <circle cx="42" cy="22" r="7" fill="#fff" />
          </>
        ) : slug === "male-escorts" ? (
          <>
            <circle cx="32" cy="18" r="9" fill="#fff" />
            <path d="M18 54c1-14 8-20 14-20s13 6 14 20" fill="#fff" />
            <rect x="29" y="28" width="6" height="8" fill="#fff" />
          </>
        ) : slug === "transsexual" ? (
          <>
            <circle cx="32" cy="20" r="10" fill="#fff" />
            <path d="M16 54c2-12 10-18 16-18s14 6 16 18" fill="#fff" />
            <circle cx="48" cy="14" r="4" fill="none" stroke="#fff" strokeWidth="2" />
          </>
        ) : (
          <>
            <circle cx="22" cy="22" r="8" fill="#fff" />
            <circle cx="42" cy="22" r="8" fill="#fff" />
            <path d="M12 54c2-12 8-16 12-16s10 4 10 10c0-6 6-10 10-10s10 4 12 16" fill="#fff" />
          </>
        )}
      </svg>
    </div>
  );
}
