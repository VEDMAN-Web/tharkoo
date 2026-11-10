import { safeHref, safeHtml } from "@/lib/sanitize";

export type NavLink = { label: string; href: string; visible: boolean };
export type FooterColumn = { title: string; visible: boolean; links: NavLink[] };
export type HomeCard = {
  slug: string;
  title: string;
  photo: string;
  blurb: string;
  visible: boolean;
  cities: string[];
};
export type HomeGroup = {
  id: string;
  kind: "cities" | "categories";
  slug: string;
  title: string;
  visible: boolean;
  cities: string[];
  showAll: boolean;
};

export type SiteContent = {
  hero: {
    desktop: string;
    mobileLines: string[];
    photo: string;
    searchPlaceholder: string;
    postLabel: string;
    postHref: string;
  };
  cardsHeading: string;
  cardsIntro: string;
  cards: HomeCard[];
  groups: HomeGroup[];
  seoTitle: string;
  seoDescription: string;
  seoIntro: string;
  header: {
    postLabel: string;
    postHref: string;
    publishLabel: string;
    servicesLabel: string;
    followLabel: string;
    searchModalPlaceholder: string;
    searchSubmit: string;
    drawer: NavLink[];
  };
  footer: {
    about: string;
    badge: string;
    columns: FooterColumn[];
    boostTitle: string;
    postLabel: string;
    postHref: string;
    countriesLabel: string;
    countryOption: string;
    copyright: string;
    backToTop: string;
  };
  age: {
    title: string;
    lead: string;
    rest: string;
    terms: string;
    yes: string;
    no: string;
    noHref: string;
  };
  cookies: {
    body: string;
    notice: string;
    noticeHref: string;
    accept: string;
    necessary: string;
  };
  support: { hours: string; whatsapp: string; telegram: string };
  socials: NavLink[];
};

const POST = "/u/post-insert/";

const CARD_FALLBACKS: { slug: string; blurb: string }[] = [
  { slug: "dating", blurb: "Meet people near you. Clear profiles, honest details, and manual ID checks." },
  { slug: "wellness", blurb: "Spa, yoga, fitness and therapeutic massage bookings from verified providers." },
  { slug: "friendship", blurb: "Make friends and find company for coffee, trips and hobbies." },
  { slug: "meetups", blurb: "Join local meetups, classes and group activities in your city." },
  { slug: "personal-ads", blurb: "Short personal notices for dating, friendship and activities." },
];

function link(label: string, href: string): NavLink {
  return { label, href, visible: true };
}

function column(title: string, links: NavLink[]): FooterColumn {
  return { title, visible: true, links };
}

export function defaultSiteContent(): SiteContent {
  return {
    hero: {
      desktop: "Single? Taken? Doesn't matter, Tharkoo is for everyone",
      mobileLines: ["Single? Taken?", "Doesn't matter,", "Tharkoo is", "for everyone"],
      photo: "/placeholders/hero.webp",
      searchPlaceholder: "Search By City, Category...",
      postLabel: "POST YOUR AD",
      postHref: POST,
    },
    cardsHeading: "Hot meetings in your city",
    cardsIntro: "Find your favourite listings on Tharkoo",
    cards: CARD_FALLBACKS.map((card) => ({
      slug: card.slug,
      title: "",
      photo: `/placeholders/${card.slug}/01.webp`,
      blurb: "",
      visible: true,
      cities: [],
    })),
    groups: [
      ...CARD_FALLBACKS.map((card, index) => ({
        id: card.slug,
        kind: "cities" as const,
        slug: card.slug,
        title: "",
        visible: true,
        cities: [],
        showAll: index === 0,
      })),
      { id: "more", kind: "categories", slug: "", title: "More categories", visible: true, cities: [], showAll: false },
    ],
    seoTitle: "Classifieds across India | Tharkoo",
    seoDescription: "Browse listings for dating, friendship, meetups, wellness, and more in your city.",
    seoIntro: "",
    header: {
      postLabel: "POST YOUR AD",
      postHref: POST,
      publishLabel: "Publish ad",
      servicesLabel: "Services for you!",
      followLabel: "Follow us",
      searchModalPlaceholder: "Search here...",
      searchSubmit: "SEARCH",
      drawer: [link("Tharkoo Blog", "/blog/"), link("Help Center", "/help/")],
    },
    footer: {
      about: "Tharkoo is a classifieds platform for people in India. Browse new listings every day in {count} cities.",
      badge: "18+ ONLY",
      columns: [
        column("Legal", [link("Terms and Conditions", "/terms/"), link("Privacy Policy", "/privacy/"), link("Cookie Policy", "/cookies/")]),
        column("Support", [link("Help Center", "/help/"), link("Submit a Report", "/submit-report/"), link("Blog", "/blog/")]),
        column("Security", [link("How to report a scam", "/scam-report/")]),
        column("Company", [link("About Tharkoo", "/cms/about/"), link("Contact us", "/contact/")]),
      ],
      boostTitle: "Boost your visibility",
      postLabel: "POST YOUR AD",
      postHref: POST,
      countriesLabel: "Countries",
      countryOption: "🇮🇳 India",
      copyright: "Copyright 2026 © Tharkoo",
      backToTop: "Back to top ↑",
    },
    age: {
      title: "Please confirm your age before continuing",
      lead: "I am over 18 years old",
      rest: "and I accept the terms of use of this site.",
      terms: "Terms and Conditions",
      yes: "ACCEPT",
      no: "Decline",
      noHref: "https://www.google.com/",
    },
    cookies: {
      body: "We use cookies to keep the site reliable and remember your choices.",
      notice: "Cookie notice",
      noticeHref: "/cookies/",
      accept: "Accept all",
      necessary: "Only necessary",
    },
    support: { hours: "", whatsapp: "", telegram: "" },
    socials: [],
  };
}

export function cardFallback(slug: string) {
  return CARD_FALLBACKS.find((card) => card.slug === slug)?.blurb || "";
}

export function isAdminRole(roles: string[] | undefined) {
  return Boolean(roles?.some((role) => role === "admin" || role === "superadmin"));
}

function text(value: unknown, max: number, fallback: string) {
  if (typeof value !== "string") return fallback;
  const clean = value.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
  return clean || fallback;
}

function optionalText(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

function lines(value: unknown, fallback: string[]) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split("\n") : fallback;
  const next = source.map((line) => optionalText(line, 80)).filter(Boolean).slice(0, 6);
  return next.length ? next : fallback;
}

function slugs(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
    .filter((item) => /^[a-z0-9-]{1,40}$/.test(item))
    .slice(0, 12);
}

function imagePath(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const href = safeHref(value.trim());
  if (!href) return "";
  if (href.startsWith("/") && !href.includes("..")) return href;
  if (href.startsWith("https://")) return href;
  return "";
}

function hrefOr(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return safeHref(value.trim()) || "";
}

function postHref(value: unknown) {
  const href = hrefOr(value, POST);
  if (href === "/u/post-insert" || href === POST || href.startsWith("/u/post-insert?")) return href.startsWith("/u/post-insert?") ? href : POST;
  return "";
}

function navList(value: unknown, fallback: NavLink[], max = 8): NavLink[] | null {
  if (!Array.isArray(value)) return fallback;
  const links: NavLink[] = [];
  for (const item of value.slice(0, max)) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const href = hrefOr(row.href, "");
    if (row.href && !href) return null;
    links.push({
      label: text(row.label, 60, "Link"),
      href: href || "/",
      visible: row.visible !== false,
    });
  }
  return links;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** Public read. Missing or old data becomes the current homepage. Unsafe hrefs fall back. */
export function readContent(homepage: unknown): SiteContent {
  const base = defaultSiteContent();
  const root = asRecord(homepage);
  const stored = asRecord(root?.content) || (root && "hero" in root ? root : null);
  if (!stored) return base;
  const parsed = sanitizeSiteContent(stored, { lenient: true });
  return parsed.ok ? parsed.content : base;
}

export function sanitizeSiteContent(
  input: unknown,
  opts: { lenient?: boolean } = {},
): { ok: true; content: SiteContent } | { ok: false; message: string } {
  const base = defaultSiteContent();
  const source = asRecord(input);
  if (!source) return { ok: false, message: "Homepage content must be an object." };
  const fail = (message: string) => (opts.lenient ? null : message);

  const heroIn = asRecord(source.hero) || {};
  const photo = imagePath(heroIn.photo, base.hero.photo);
  if (!photo) {
    const message = fail("Hero photo must be a site path or an https image.");
    if (message) return { ok: false, message };
  }
  const heroPost = postHref(heroIn.postHref);
  if (!heroPost) {
    const message = fail("The post button must open /u/post-insert/.");
    if (message) return { ok: false, message };
  }

  const headerIn = asRecord(source.header) || {};
  const headerPost = postHref(headerIn.postHref);
  if (headerIn.postHref && !headerPost) {
    const message = fail("The header post button must open /u/post-insert/.");
    if (message) return { ok: false, message };
  }
  const drawer = navList(headerIn.drawer, base.header.drawer);
  if (!drawer) return { ok: false, message: "A menu link is not a safe address." };

  const footerIn = asRecord(source.footer) || {};
  const footerPost = postHref(footerIn.postHref);
  if (footerIn.postHref && !footerPost) return { ok: false, message: "The footer post button must open /u/post-insert/." };
  let columns = base.footer.columns;
  if (Array.isArray(footerIn.columns)) {
    const next: FooterColumn[] = [];
    for (const item of footerIn.columns.slice(0, 6)) {
      const row = asRecord(item);
      if (!row) return { ok: false, message: "A footer column is incomplete." };
      const links = navList(row.links, []);
      if (!links) return { ok: false, message: "A footer link is not a safe address." };
      next.push({ title: text(row.title, 40, "Column"), visible: row.visible !== false, links });
    }
    columns = next.length ? next : base.footer.columns;
  }

  const ageIn = asRecord(source.age) || {};
  const noHref = hrefOr(ageIn.noHref, base.age.noHref);
  if (ageIn.noHref && !noHref) return { ok: false, message: "The age-gate decline link is not a safe address." };

  const cookiesIn = asRecord(source.cookies) || {};
  const noticeHref = hrefOr(cookiesIn.noticeHref, base.cookies.noticeHref);
  if (cookiesIn.noticeHref && !noticeHref) return { ok: false, message: "The cookie notice link is not a safe address." };

  let cards = base.cards;
  if (Array.isArray(source.cards)) {
    const next: HomeCard[] = [];
    for (const item of source.cards.slice(0, 12)) {
      const row = asRecord(item);
      if (!row) return { ok: false, message: "A category card is incomplete." };
      const slug = optionalText(row.slug, 40).toLowerCase();
      if (!/^[a-z0-9-]{1,40}$/.test(slug)) return { ok: false, message: "A category card needs a real category slug." };
      const cardPhoto = imagePath(row.photo, `/placeholders/${slug}/01.webp`);
      if (!cardPhoto) return { ok: false, message: "A category photo must be a site path or an https image." };
      next.push({
        slug,
        title: optionalText(row.title, 60),
        photo: cardPhoto,
        blurb: optionalText(row.blurb, 240),
        visible: row.visible !== false,
        cities: slugs(row.cities),
      });
    }
    cards = next;
  }

  let groups = base.groups;
  if (Array.isArray(source.groups)) {
    const next: HomeGroup[] = [];
    for (const item of source.groups.slice(0, 12)) {
      const row = asRecord(item);
      if (!row) return { ok: false, message: "A city row is incomplete." };
      const kind = row.kind === "categories" ? "categories" : "cities";
      const slug = optionalText(row.slug, 40).toLowerCase();
      if (kind === "cities" && !/^[a-z0-9-]{1,40}$/.test(slug)) return { ok: false, message: "A city row needs a category slug." };
      next.push({
        id: optionalText(row.id, 40) || slug || "more",
        kind,
        slug,
        title: optionalText(row.title, 80),
        visible: row.visible !== false,
        cities: slugs(row.cities),
        showAll: row.showAll === true,
      });
    }
    groups = next.length ? next : base.groups;
  }

  const socials = navList(source.socials, base.socials);
  if (!socials) return { ok: false, message: "A social link is not a safe address." };

  const supportIn = asRecord(source.support) || {};
  const intro = typeof source.seoIntro === "string" ? safeHtml(source.seoIntro) : base.seoIntro;

  return {
    ok: true,
    content: {
      hero: {
        desktop: text(heroIn.desktop, 160, base.hero.desktop),
        mobileLines: lines(heroIn.mobileLines, base.hero.mobileLines),
        photo: photo || base.hero.photo,
        searchPlaceholder: text(heroIn.searchPlaceholder, 80, base.hero.searchPlaceholder),
        postLabel: text(heroIn.postLabel, 40, base.hero.postLabel),
        postHref: heroPost || POST,
      },
      cardsHeading: text(source.cardsHeading, 80, base.cardsHeading),
      cardsIntro: text(source.cardsIntro, 160, base.cardsIntro),
      cards,
      groups,
      seoTitle: text(source.seoTitle, 120, base.seoTitle),
      seoDescription: text(source.seoDescription, 240, base.seoDescription),
      seoIntro: intro,
      header: {
        postLabel: text(headerIn.postLabel, 40, base.header.postLabel),
        postHref: headerPost || POST,
        publishLabel: text(headerIn.publishLabel, 40, base.header.publishLabel),
        servicesLabel: text(headerIn.servicesLabel, 40, base.header.servicesLabel),
        followLabel: text(headerIn.followLabel, 40, base.header.followLabel),
        searchModalPlaceholder: text(headerIn.searchModalPlaceholder, 80, base.header.searchModalPlaceholder),
        searchSubmit: text(headerIn.searchSubmit, 24, base.header.searchSubmit),
        drawer: drawer || base.header.drawer,
      },
      footer: {
        about: text(footerIn.about, 400, base.footer.about),
        badge: text(footerIn.badge, 24, base.footer.badge),
        columns,
        boostTitle: text(footerIn.boostTitle, 60, base.footer.boostTitle),
        postLabel: text(footerIn.postLabel, 40, base.footer.postLabel),
        postHref: footerPost || POST,
        countriesLabel: text(footerIn.countriesLabel, 40, base.footer.countriesLabel),
        countryOption: text(footerIn.countryOption, 40, base.footer.countryOption),
        copyright: text(footerIn.copyright, 80, base.footer.copyright),
        backToTop: text(footerIn.backToTop, 40, base.footer.backToTop),
      },
      age: {
        title: text(ageIn.title, 120, base.age.title),
        lead: text(ageIn.lead, 80, base.age.lead),
        rest: text(ageIn.rest, 160, base.age.rest),
        terms: text(ageIn.terms, 60, base.age.terms),
        yes: text(ageIn.yes, 24, base.age.yes),
        no: text(ageIn.no, 24, base.age.no),
        noHref: noHref || base.age.noHref,
      },
      cookies: {
        body: text(cookiesIn.body, 300, base.cookies.body),
        notice: text(cookiesIn.notice, 40, base.cookies.notice),
        noticeHref: noticeHref || base.cookies.noticeHref,
        accept: text(cookiesIn.accept, 40, base.cookies.accept),
        necessary: text(cookiesIn.necessary, 40, base.cookies.necessary),
      },
      support: {
        hours: optionalText(supportIn.hours, 80),
        whatsapp: optionalText(supportIn.whatsapp, 20).replace(/[^\d+]/g, ""),
        telegram: optionalText(supportIn.telegram, 32).replace(/[^\w@]/g, ""),
      },
      socials: (socials || []).filter((item) => item.href.startsWith("https://")),
    },
  };
}
