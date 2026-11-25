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

/** The site's and the organisation's stable ids, so every page can point at the same two entities. */
export const siteId = () => `${canonical("/")}#website`;
export const organizationId = () => `${canonical("/")}#organization`;

/** H22.2: how the brand is described to search engines. One sentence, one place. */
export const ORGANIZATION_DESCRIPTION = "Tharkoo (tharkoo.com) is a free classifieds website in India. Post an ad, find local listings and contact people after an ID check.";

export function organizationNode(name: string, extra?: { logo?: string; sameAs?: string[] }) {
  const sameAs = (extra?.sameAs || []).filter((href) => /^https?:\/\//i.test(href));
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": organizationId(),
    name,
    alternateName: ["Tharkoo.com"],
    description: ORGANIZATION_DESCRIPTION,
    areaServed: { "@type": "Country", name: "India" },
    url: canonical("/"),
    ...(extra?.logo ? { logo: extra.logo } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteNode(name: string, searchPath = "/search/") {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": siteId(),
    name,
    alternateName: ["Tharkoo.com"],
    url: canonical("/"),
    inLanguage: "en-IN",
    publisher: { "@id": organizationId() },
    potentialAction: {
      "@type": "SearchAction",
      target: `${canonical(searchPath)}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

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
  itemCondition?: string;
  datePosted?: string;
  validThrough?: string;
  hiringOrganization?: string;
  jobLocation?: string;
  /** Set in the SEO center for the ad's category; leave out to use the built-in choice. */
  mapping?: AdSchemaMapping;
  /** H16.4: a people ad (a person is the offer): nothing commercial is ever written for it. */
  people?: boolean;
  /** H16.4: the poster has passed the ID check. A JobPosting is written only for a verified poster. */
  verifiedPoster?: boolean;
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
  ],
};

/** Names of the required fields an ad does not have for the given schema type. */
export function missingSchemaFields(mapping: AdSchemaMapping, input: ListingSchemaInput): string[] {
  if (mapping === "none") return [];
  return AD_SCHEMA_REQUIRED[mapping]
    .filter(({ key }) => {
      return !input[key];
    })
    .map(({ label }) => label);
}

function jobPostingNode(input: ListingSchemaInput) {
  // H16.4: only a real, verified job; never half-filled.
  if (!input.verifiedPoster) return null;
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

/** A property ad: a RealEstateListing with its posting date. */
function realEstateNode(input: ListingSchemaInput) {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: input.name,
    description: input.description,
    url: input.url,
    ...(input.datePosted ? { datePosted: input.datePosted } : {}),
    ...(input.image ? { image: [input.image] } : {}),
  };
}

export function listingJsonLd(input: ListingSchemaInput) {
  const image = input.image ? [input.image] : undefined;
  // H16.4: a person is never an offer: no node at all for a people ad, whatever the category or the SEO mapping says.
  if (input.people) return null;
  if (input.mapping === "none") return null;
  if (input.mapping === "JobPosting") return jobPostingNode(input);
  // H21.8: a Product needs an offer, a review or a rating to be valid, and an ad has none of them: no node at all.
  if (input.mapping === "Product") return null;
  if (PERSONAL.has(input.category)) return null;
  if (input.category === "jobs") return jobPostingNode(input);
  if (input.category === "property") return realEstateNode(input);
  if (SERVICES.has(input.category)) {
    return {
      "@context": "https://schema.org",
      "@type": "Service",
      name: input.name,
      description: input.description,
      url: input.url,
      ...(image ? { image } : {}),
      areaServed: input.city || "India",
    };
  }
  return null;
}

export interface OrganizationSettings {
  name?: string;
  logo?: string;
  sameAs?: string[];
  email?: string;
  phone?: string;
}

/** Organization schema with the SEO-center fields on top of the built-in ones. */
export function organizationFromSettings(
  defaultName: string,
  base: { logo?: string },
  settings?: OrganizationSettings | null,
  /** The support contact the site shows, used for the contact point when the settings have none. */
  fallbackContact?: { email?: string; phone?: string },
) {
  // H17.5: the social links come only from the admin list (empty by default), never from the footer.
  const node = organizationNode(settings?.name?.trim() || defaultName, {
    logo: settings?.logo?.trim() || base.logo,
    sameAs: settings?.sameAs,
  });
  const fromSettings = Boolean(settings?.email?.trim() || settings?.phone?.trim());
  const email = (fromSettings ? settings?.email : fallbackContact?.email)?.trim();
  const phone = (fromSettings ? settings?.phone : fallbackContact?.phone)?.trim();
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

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_ONLY = /^[A-Za-z]+\.? \d{4}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** An ISO 8601 date for a stored date: a Date, a date already in ISO form, or a written date like "March 3, 2026". Nothing when it cannot be read. */
export function isoDate(value?: string | Date | null): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  const text = value.trim();
  if (!text) return undefined;
  if (DATE_ONLY.test(text) || DATE_TIME.test(text)) return Number.isNaN(Date.parse(text)) ? undefined : text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  const month = `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}`;
  // "November 2026" names a month, not a day: ISO 8601 allows the month alone.
  return MONTH_ONLY.test(text) ? month : `${month}-${pad(parsed.getDate())}`;
}

export function blogPostingNode(input: { headline: string; datePublished?: string; dateModified?: string; author?: string; image?: string; url: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.headline,
    ...(input.datePublished || input.dateModified ? { datePublished: input.datePublished || input.dateModified } : {}),
    ...(input.dateModified || input.datePublished ? { dateModified: input.dateModified || input.datePublished } : {}),
    author: { "@type": input.author && input.author !== "Tharkoo" ? "Person" : "Organization", name: input.author || "Tharkoo" },
    publisher: { "@type": "Organization", name: "Tharkoo", logo: canonical("/brand/logo-mark-512.png") },
    mainEntityOfPage: input.url,
    url: input.url,
    ...(input.image ? { image: [input.image] } : {}),
  };
}

/** An ItemList whose count is the number of items written in it, so it never claims more than it lists. */
export function itemListNode(input: { url: string; items: { url: string; name: string; position: number }[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: input.items.length,
    url: input.url,
    itemListElement: input.items.map((item) => ({
      "@type": "ListItem",
      position: item.position,
      url: item.url,
      name: item.name,
    })),
  };
}

/** A blog post as a BlogPosting: ISO dates, the cover (or the default image) and the author. A date that cannot be read is left out. */
export function blogPostingFromPost(
  post: { title: string; date?: string | null; updatedAt?: Date | string | null; author?: string | null; cover?: string | null },
  url: string,
  defaultImage: string,
) {
  const cover = (post.cover || "").trim();
  const published = isoDate(post.date);
  return blogPostingNode({
    headline: post.title,
    datePublished: published,
    dateModified: isoDate(post.updatedAt) || published,
    author: post.author || undefined,
    image: /^https:\/\/[^\s"'<>]+$/.test(cover) ? cover : defaultImage,
    url,
  });
}

/** A WebPage node named by the page's title (never its path). */
export function webPageNode(input: { name: string; path: string; siteName: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.name,
    url: canonical(input.path),
    isPartOf: { "@type": "WebSite", "@id": siteId(), name: input.siteName, url: canonical("/") },
  };
}

/** The JSON-LD of an ad page: a breadcrumb that ends with the ad, and the ad's own node unless it is a sample (demo) ad, which never claims an offer, product, job or rating. */
export function adJsonLdNodes(input: { crumbs: Crumb[]; title: string; path: string; sample: boolean; listing: ListingSchemaInput }) {
  const nodes: Record<string, unknown>[] = [breadcrumbList([...input.crumbs, { name: input.title, path: input.path }])];
  if (input.sample) return nodes;
  const own = listingJsonLd(input.listing);
  if (own) nodes.push(own);
  return nodes;
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
