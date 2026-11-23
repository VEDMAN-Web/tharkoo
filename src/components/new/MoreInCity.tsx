import Link from "next/link";

/** H17.3: a plain link from an ad page to the city page, so a crawler (and a visitor) can go on to the rest of that city's ads. */
export function MoreInCity({ href, text }: { href: string; text: string }) {
  return (
    <p className="tkn-more-city" data-tk="more-in-city">
      <Link href={href} prefetch={false}>
        {text}
      </Link>
    </p>
  );
}
