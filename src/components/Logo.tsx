import Link from "next/link";
import Image from "next/image";

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
      <Image className="tk-logo-mark" src="/brand/logo-mark.svg" alt="" width={28} height={28} priority aria-hidden />
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
