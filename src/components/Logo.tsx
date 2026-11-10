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
    <span className="inline-flex shrink-0 items-center gap-2">
      <Image src="/brand/logo-mark.svg" alt="" width={box} height={box} priority />
      <span className="whitespace-nowrap font-display text-[22px] font-semibold leading-none text-text sm:text-[28px]">
        {name.toLowerCase()}
        <span className="text-gold">.</span>
      </span>
    </span>
  );
  if (!href) return mark;
  return (
    <Link href={href} className="inline-flex shrink-0" title={name} aria-label={name}>
      {mark}
    </Link>
  );
}
