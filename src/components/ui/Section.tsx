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
    <section id={id} className={cn("py-12 lg:py-20", className)}>
      <Container>
        {title || eyebrow || action ? (
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              {eyebrow ? <p className="t-overline mb-2">{eyebrow}</p> : null}
              {title ? <h2 className="t-h2">{title}</h2> : null}
            </div>
            {action ? (
              <Link href={action.href} className="t-small text-gold shrink-0" prefetch={false}>
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
