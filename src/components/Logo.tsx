import Link from "next/link";

function Mark({ height = 25 }: { height?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.svg" alt="" width={height} height={height} />
  );
}

export function Logo({
  name,
  href = "/",
  size = "md",
  country,
}: {
  name: string;
  href?: string | null;
  size?: "md" | "lg";
  country?: string;
}) {
  const mark = (
    <span className={`logo-lockup ${size === "lg" ? "logo-lockup-lg" : ""}`}>
      <span className="logo-row">
        <Mark height={size === "lg" ? 32 : 25} />
        <span className="logo-word">{name.toLowerCase()}</span>
      </span>
      {country ? <span className="country logo-country">{country}</span> : null}
    </span>
  );
  if (!href) return mark;
  return (
    <Link href={href} className="logo-mark-link" title={name}>
      {mark}
    </Link>
  );
}
