import Link from "next/link";
import { cn } from "@/lib/utils";
import { Container } from "./Container";

export function Section({
  id,
  eyebrow,
  title,
  action,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn(className)}>
      <Container>
        {title || eyebrow || action ? (
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              {eyebrow ? <p className="t-overline mb-2">{eyebrow}</p> : null}
              {title ? <h2 className="t-h2">{title}</h2> : null}
            </div>
            {action ? (
              <Link href={action.href} className="t-small shrink-0" style={{ color: "var(--accent)" }} prefetch={false}>
                {action.label}
              </Link>
            ) : null}
          </div>
        ) : null}
        {children}
      </Container>
    </section>
  );
}
