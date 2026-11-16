import Link from "next/link";

export function SectionHead({
  id,
  eyebrow,
  tone,
  title,
  link,
}: {
  id: string;
  eyebrow: string;
  tone: "rose" | "lavender" | "peach";
  title: string;
  link?: { href: string; text: string };
}) {
  return (
    <div className="tkh-head" data-reveal>
      <div>
        <p className={`tkh-eyebrow tkh-eyebrow-${tone}`}>{eyebrow}</p>
        <h2 id={id} className="tkh-h2">
          {title}
        </h2>
      </div>
      {link ? (
        <Link className="tkh-more" href={link.href} prefetch={false}>
          {link.text}
        </Link>
      ) : null}
    </div>
  );
}
