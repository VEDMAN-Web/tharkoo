import Link from "next/link";

export function Logo({
  name = "tharkoo",
  href = "/",
  country = "India",
  city,
}: {
  name?: string;
  href?: string | null;
  size?: "md" | "lg";
  country?: string;
  city?: string;
}) {
  const mark = (
    <span className="tk-logo" data-tk="logo">
      <svg className="tk-logo-mark" width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true" focusable="false">
        <path d="M3.5 24V12.2C3.5 7.4 7.2 3.6 11.8 3.6c4.6 0 8.3 3.8 8.3 8.6V24" strokeWidth="3.2" strokeLinecap="round" style={{ stroke: "var(--primary)" }} />
        <path d="M8.2 24V13.4c0-3.9 3-7 6.6-7s6.6 3.1 6.6 7V24" strokeWidth="3.2" strokeLinecap="round" style={{ stroke: "var(--gold)" }} />
      </svg>
      <span>
        <span className="tk-wordmark">{name.toLowerCase()}</span>
        <span className="tk-logo-sub">{country}</span>
        {city ? <span className="tk-logo-city">{city}</span> : null}
      </span>
    </span>
  );
  if (!href) return mark;
  return (
    <Link href={href}>
      {mark}
    </Link>
  );
}
