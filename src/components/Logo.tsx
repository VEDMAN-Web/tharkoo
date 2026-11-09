import Link from "next/link";

export function Logo({
  name,
  href = "/",
  size = "md",
}: {
  name: string;
  href?: string | null;
  size?: "md" | "lg";
}) {
  const mark = (
    <span className={`logo-mark ${size === "lg" ? "logo-mark-lg" : ""}`}>
      <span className="dot" />
      {name.toLowerCase()}
    </span>
  );
  if (!href) return mark;
  return (
    <Link href={href} className="logo-mark-link">
      {mark}
    </Link>
  );
}
