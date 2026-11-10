import { canonical } from "@/lib/seo";

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbList(items: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: canonical(item.path),
    })),
  };
}

export function organizationNode(name: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url: canonical("/"),
  };
}

export function websiteNode(name: string, searchPath = "/search/") {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url: canonical("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: `${canonical(searchPath)}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function productOffer(input: {
  name: string;
  description: string;
  url: string;
  image?: string;
  seller: string;
  sellerType?: "Person" | "Organization";
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description,
    url: input.url,
    ...(input.image ? { image: [input.image] } : {}),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      url: input.url,
      seller: { "@type": input.sellerType || "Person", name: input.seller },
    },
  };
}

export function itemListNode(input: { url: string; total: number; items: { url: string; name: string; position: number }[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: input.total,
    url: input.url,
    itemListElement: input.items.map((item) => ({
      "@type": "ListItem",
      position: item.position,
      url: item.url,
      name: item.name,
    })),
  };
}

export function faqPage(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function publicPath(path: string) {
  const [base, query] = path.split("?");
  const root = base?.startsWith("/") ? base : `/${base || ""}`;
  if (!query) return root.endsWith("/") ? root : `${root}/`;
  const params = new URLSearchParams(query);
  for (const key of [...params.keys()]) {
    if (/^(utm_|gclid$|fbclid$|mc_|yclid$|ref$)/i.test(key)) params.delete(key);
  }
  const next = params.toString();
  const clean = root.endsWith("/") ? root : `${root}/`;
  return next ? `${clean}?${next}` : clean;
}
