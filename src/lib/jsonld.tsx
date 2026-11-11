import { breadcrumbList, type Crumb } from "@/lib/seo/schema";

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export function breadcrumbJsonLd(items: Crumb[]) {
  return breadcrumbList(items);
}
