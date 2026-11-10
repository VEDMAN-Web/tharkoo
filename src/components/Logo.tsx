import Link from "next/link";
import Image from "next/image";

export function Logo({
  name,
  href = "/",
  size = "md",
}: {
  name: string;
  href?: string | null;
  size?: "md" | "lg";
  country?: string;
}) {
  const box = size === "lg" ? 32 : 32;
  const mark = (
    <span className="inline-flex items-center gap-2">
      <Image src="/brand/logo-mark.svg" alt="" width={box} height={box} priority />
      <span className="font-display text-[28px] font-semibold leading-none text-text">
        {name.toLowerCase()}
        <span className="text-gold">.</span>
      </span>
    </span>
  );
  if (!href) return mark;
  return (
    <Link href={href} className="inline-flex" title={name} aria-label={name}>
      {mark}
    </Link>
  );
}
