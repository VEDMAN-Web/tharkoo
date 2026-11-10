import Link from "next/link";
import { JsonLd, breadcrumbJsonLd } from "@/lib/jsonld";

export function Breadcrumbs({
  crumbs,
  jsonLd = false,
}: {
  crumbs: { name: string; path: string }[];
  backHref?: string;
  backLabel?: string;
  jsonLd?: boolean;
}) {
  return (
    <nav aria-label="Breadcrumb" className="tk-crumbs">
      {jsonLd ? <JsonLd data={breadcrumbJsonLd(crumbs)} /> : null}
      {crumbs.map((crumb, index) => (
        <span key={crumb.path}>
          {index > 0 ? <span style={{ color: "var(--muted)" }}> / </span> : null}
          <Link href={crumb.path} prefetch={false}>
            {crumb.name}
          </Link>
        </span>
      ))}
    </nav>
  );
}
