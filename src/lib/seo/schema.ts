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

export function organizationNode(name: string, extra?: { logo?: string; sameAs?: string[] }) {
  const sameAs = (extra?.sameAs || []).filter((href) => /^https?:\/\//i.test(href));
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url: canonical("/"),
    ...(extra?.logo ? { logo: extra.logo } : {}),
    ...(sameAs.length ? { sameAs } : {}),
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

const GOODS = new Set(["property", "vehicles", "buy-and-sell", "pets"]);
const SERVICES = new Set(["wellness", "education"]);
const PERSONAL = new Set(["dating", "friendship", "meetups", "personal-ads"]);

export type AdSchemaMapping = "JobPosting" | "Product" | "none";
export const AD_SCHEMA_MAPPINGS: readonly AdSchemaMapping[] = ["JobPosting", "Product", "none"];

export interface ListingSchemaInput {
  category: string;
  name: string;
  description: string;
  url: string;
  image?: string;
  city?: string;
  price?: number | null;
  itemCondition?: string;
  datePosted?: string;
  validThrough?: string;
  hiringOrganization?: string;
  jobLocation?: string;
  /** Set in the SEO center for the ad's category; leave out to use the built-in choice. */
  mapping?: AdSchemaMapping;
}

/** What Google needs for each schema type; an ad missing any of these is skipped, never published half-filled. */
export const AD_SCHEMA_REQUIRED: Record<Exclude<AdSchemaMapping, "none">, { key: keyof ListingSchemaInput; label: string }[]> = {
  JobPosting: [
    { key: "name", label: "title" },
    { key: "description", label: "description" },
    { key: "datePosted", label: "date posted" },
    { key: "validThrough", label: "expiry date" },
    { key: "hiringOrganization", label: "hiring company" },
    { key: "jobLocation", label: "job location" },
  ],
  Product: [
    { key: "name", label: "title" },
    { key: "description", label: "description" },
    { key: "price", label: "price" },
  ],
};

/** Names of the required fields an ad does not have for the given schema type. */
export function missingSchemaFields(mapping: AdSchemaMapping, input: ListingSchemaInput): string[] {
  if (mapping === "none") return [];
  return AD_SCHEMA_REQUIRED[mapping]
    .filter(({ key }) => {
      const value = input[key];
      return key === "price" ? !(typeof value === "number" && value > 0) : !value;
    })
    .map(({ label }) => label);
}

function jobPostingNode(input: ListingSchemaInput) {
  if (missingSchemaFields("JobPosting", input).length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: input.name,
    description: input.description,
    datePosted: input.datePosted,
    validThrough: input.validThrough,
    hiringOrganization: { "@type": "Organization", name: input.hiringOrganization },
    jobLocation: { "@type": "Place", name: input.jobLocation },
    url: input.url,
  };
}

function productNode(input: ListingSchemaInput, requirePrice: boolean) {
  const price = typeof input.price === "number" && input.price > 0 ? input.price : null;
  if (requirePrice && !price) return null;
  const image = input.image ? [input.image] : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description,
    url: input.url,
    ...(image ? { image } : {}),
    ...(price
      ? {
          offers: {
            "@type": "Offer",
            price: String(price),
            priceCurrency: "INR",
            availability: "https://schema.org/InStock",
            url: input.url,
            ...(input.itemCondition ? { itemCondition: input.itemCondition } : {}),
          },
        }
      : {}),
  };
}

export function listingJsonLd(input: ListingSchemaInput) {
  const price = typeof input.price === "number" && input.price > 0 ? input.price : null;
  const image = input.image ? [input.image] : undefined;
  if (input.mapping === "none") return null;
  if (input.mapping === "JobPosting") return jobPostingNode(input);
  if (input.mapping === "Product") return productNode(input, true);
  if (PERSONAL.has(input.category)) return null;
  if (input.category === "jobs") return jobPostingNode(input);
  if (SERVICES.has(input.category)) {
    return {
      "@context": "https://schema.org",
      "@type": "Service",
      name: input.name,
      description: input.description,
      url: input.url,
      ...(image ? { image } : {}),
      areaServed: input.city || "India",
      ...(price
        ? { offers: { "@type": "Offer", price: String(price), priceCurrency: "INR", availability: "https://schema.org/InStock", url: input.url } }
        : {}),
    };
  }
  if (!GOODS.has(input.category)) return null;
  return productNode(input, false);
}

export interface OrganizationSettings {
  name?: string;
  logo?: string;
  sameAs?: string[];
  email?: string;
  phone?: string;
}

/** Organization schema with the SEO-center fields on top of the built-in ones. */
export function organizationFromSettings(defaultName: string, base: { logo?: string; sameAs?: string[] }, settings?: OrganizationSettings | null) {
  const node = organizationNode(settings?.name?.trim() || defaultName, {
    logo: settings?.logo?.trim() || base.logo,
    sameAs: settings?.sameAs?.length ? settings.sameAs : base.sameAs,
  });
  const email = settings?.email?.trim();
  const phone = settings?.phone?.trim();
  return email || phone
    ? { ...node, contactPoint: { "@type": "ContactPoint", contactType: "customer support", ...(email ? { email } : {}), ...(phone ? { telephone: phone } : {}) } }
    : node;
}

export function aboutPageNode(name: string, path = "/cms/about/") {
  return { "@context": "https://schema.org", "@type": "AboutPage", name, url: canonical(path) };
}

export function contactPageNode(name: string, path = "/contact/") {
  return { "@context": "https://schema.org", "@type": "ContactPage", name, url: canonical(path) };
}

export function blogPostingNode(input: { headline: string; datePublished?: string; dateModified?: string; author?: string; image?: string; url: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.headline,
    datePublished: input.datePublished || input.dateModified,
    dateModified: input.dateModified || input.datePublished,
    author: { "@type": input.author && input.author !== "Tharkoo" ? "Person" : "Organization", name: input.author || "Tharkoo" },
    publisher: { "@type": "Organization", name: "Tharkoo", logo: canonical("/brand/logo-mark.svg") },
    mainEntityOfPage: input.url,
    url: input.url,
    ...(input.image ? { image: [input.image] } : {}),
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
