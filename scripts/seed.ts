import mongoose from "mongoose";
import { CATEGORIES, CITY_STATE, CITIES, DISTRICTS, STATE_SLUGS, TAG_GROUPS, TOP_CITIES } from "../src/data/catalog";
import { DEFAULT_SEO } from "../src/lib/seo";
import { slugify } from "../src/lib/utils";
import { HELP_ARTICLES, BLOG_POSTS } from "../src/data/help";
import { CREDIT_PACKS } from "../src/lib/credit-packs";
import {
  AttributeGroup,
  Banner,
  BannedWord,
  BlogPost,
  Category,
  Coupon,
  CreditPack,
  FeatureFlag,
  HelpArticle,
  Listing,
  Location,
  Page,
  Product,
  SeoTemplate,
  Site,
} from "../src/lib/models";

function stateSlug(name: string) {
  return STATE_SLUGS[name] || slugify(name);
}

const VARIANTS = ["free", "top", "supertop", "highlight", "flash", "star"] as const;
const NAMES = [
  "Asha", "Ravi", "Meera", "Imran", "Kavya", "Arjun", "Nisha", "Vikram",
  "Pooja", "Sahil", "Diya", "Rohan", "Ananya", "Farhan", "Isha",
];

function idFor(i: number) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let n = i + 100000;
  let s = "";
  while (s.length < 7) {
    s = alphabet[n % alphabet.length] + s;
    n = Math.floor(n / alphabet.length);
  }
  return `in${s}`;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing");
  await mongoose.connect(uri);

  await Promise.all([
    Category.deleteMany({}),
    Location.deleteMany({}),
    Listing.deleteMany({}),
    SeoTemplate.deleteMany({}),
    Site.deleteMany({}),
    Page.deleteMany({}),
    HelpArticle.deleteMany({}),
    BlogPost.deleteMany({}),
    CreditPack.deleteMany({}),
    Banner.deleteMany({}),
    Coupon.deleteMany({}),
    BannedWord.deleteMany({}),
    FeatureFlag.deleteMany({}),
    AttributeGroup.deleteMany({}),
    Product.deleteMany({}),
  ]);

  await Site.create({
    key: "default",
    name: "Tharkoo",
    logoText: "tharkoo",
    tagline:
      "Welcome to Tharkoo. Browse Call Girls, Massages, Male Escorts, Transsexual and Adult Meetings across Indian cities. Post your ad absolutely FREE.",
    legalName: "SparkBeta Tech",
    countryName: "India",
    supportHours: "Mon–Fri 14:00–20:00 IST",
    supportWhatsapp: "919000000000",
    supportTelegram: "tharkoo_support",
    ageGateEnabled: true,
    ageGateTitle: "Are you over 18?",
    ageGateBody: "This website contains adult material. You must be 18 years or older to enter.",
    ageYes: "I'm over 18",
    ageNo: "I'm under 18",
    cookieBody: "We use necessary cookies to run the site. Optional analytics stay off until you accept.",
    cookieAccept: "Accept all",
    cookieNecessary: "Necessary only",
    searchPlaceholder: "Search by City, Category...",
    postCta: "Post your ad",
    theme: {
      accent: "#e20044",
      primary: "#00a0e8",
      page: "#ececec",
      top: "#ff6a00",
      link: "#0077b3",
    },
    footerLinks: [
      { label: "About", href: "/about/" },
      { label: "Help centre", href: "/help/" },
      { label: "Blog", href: "/blog/" },
      { label: "Submit a report", href: "/submit-report/" },
      { label: "How to report a scam", href: "/help/scams/" },
      { label: "Terms", href: "/terms/" },
      { label: "Privacy", href: "/privacy/" },
      { label: "Cookies", href: "/cookies/" },
      { label: "Grievance officer", href: "/grievance/" },
    ],
    socialLinks: ["Instagram", "X", "TikTok", "Bluesky", "YouTube", "Facebook"].map((label) => ({
      label,
      href: `https://www.google.com/search?q=Tharkoo+${label}`,
    })),
    homepage: {
      blocks: [
        {
          id: "hero",
          type: "hero",
          enabled: true,
          title: "Hot meetings in your city",
          subtitle: "Find your favourite Escort in Tharkoo",
        },
        { id: "categories", type: "categories", enabled: true, cityCount: 3, moreLabel: "More cities" },
        {
          id: "boost",
          type: "boost",
          enabled: true,
          title: "Boost your visibility",
          body: "Post your ad free. Promote with Top, Flash or Star to sit above the feed in your city.",
          cta: "Post your ad",
          href: "/u/post-insert/",
        },
        {
          id: "intro",
          type: "html",
          enabled: true,
          html: "<p>Welcome to Tharkoo, adult classifieds in India. Browse Call Girls, massages, male escorts, transsexual ads and Adult Meetings. Cannot find what you are looking for? Post your ad absolutely FREE.</p>",
        },
      ],
    },
  });

  await SeoTemplate.insertMany(Object.values(DEFAULT_SEO));
  await Category.insertMany([...CATEGORIES]);

  await Location.create({ kind: "country", name: "India", slug: "india", status: "active" });

  const states = [...new Set(Object.values(CITY_STATE))];
  await Location.insertMany(
    states.map((name) => ({
      kind: "state",
      name,
      slug: stateSlug(name),
      parentSlug: "india",
      status: "active",
    })),
  );

  await Location.insertMany(
    CITIES.map((name) => ({
      kind: "city",
      name,
      slug: slugify(name),
      parentSlug: stateSlug(CITY_STATE[name]),
      stateSlug: stateSlug(CITY_STATE[name]),
      status: "active",
      isTop: (TOP_CITIES as readonly string[]).includes(name),
      sortOrder: (TOP_CITIES as readonly string[]).indexOf(name) >= 0 ? (TOP_CITIES as readonly string[]).indexOf(name) : 99,
    })),
  );

  const districtDocs = Object.entries(DISTRICTS).flatMap(([city, districts]) =>
    districts.map((name) => ({
      kind: "district" as const,
      name,
      slug: slugify(name),
      parentSlug: slugify(city),
      citySlug: slugify(city),
      stateSlug: stateSlug(CITY_STATE[city]),
      status: "active",
    })),
  );
  await Location.insertMany(districtDocs);

  const listings = [];
  let i = 0;
  const seedCities = [...TOP_CITIES, "Vadodara", "Lucknow", "Indore", "Nagpur", "Kochi"];
  for (const category of CATEGORIES) {
    for (const city of seedCities) {
      const districts = DISTRICTS[city] ?? [""];
      for (let n = 0; n < 8; n++) {
        const variant = VARIANTS[n % VARIANTS.length];
        const name = NAMES[(i + n) % NAMES.length];
        const district = districts[n % districts.length] || undefined;
        const publicId = idFor(i);
        const phone = `9${String(8000000000 + i).slice(-9)}`;
        const title = `${phone} - ${city} ${category.name}: ${name}`;
        const hasPhotos = variant !== "free";
        listings.push({
          publicId,
          slug: `${slugify(title)}-${publicId}`,
          title,
          description: `${name}. Independent. Direct meeting. Cash only, no advance. Available in ${city}${district ? `, ${district}` : ""}. Original demo listing for Tharkoo — not copied from another site.`,
          displayName: name,
          age: 22 + ((i + n) % 16),
          categorySlug: category.slug,
          stateSlug: stateSlug(CITY_STATE[city]),
          citySlug: slugify(city),
          districtSlug: district ? slugify(district) : undefined,
          place: district || "City-wide",
          chips: [`${22 + ((i + n) % 16)} years`, city],
          photos: hasPhotos
            ? Array.from({ length: variant === "supertop" || variant === "flash" ? 3 : 1 }, (_, p) => `/placeholders/p${((i + n + p) % 8) + 1}.jpg`)
            : [],
          tags: {
            tag1: n % 2 === 0 ? "Independent" : "Agency",
            tag2: n % 2 === 0 ? ["Incall"] : ["Outcall"],
            tag3: ["Evening", "Night"],
            tag4: n % 3 === 0 ? ["Video call"] : ["Girlfriend experience"],
            tag5: ["Hindi", "English"],
            tag6: ["Cash"],
            tag7: ["Slim"],
          },
          photoCountVisible: variant === "free" ? 1 : variant === "supertop" || variant === "flash" ? 3 : variant === "star" ? 1 : 1,
          variant,
          verified: n % 4 === 0,
          subscriber: n % 5 === 0,
          lastBumpedAt: new Date(Date.now() - n * 36e5 - i * 1e5),
          publishedAt: new Date(Date.now() - (n + 1) * 864e5),
          status: "live",
          phone,
          whatsapp: n % 2 === 0 ? phone : undefined,
          telegram: n % 3 === 0 ? "tharkoo_demo" : undefined,
          emailOn: n % 4 === 1,
        });
        i += 1;
      }
    }
  }
  await Listing.insertMany(listings);

  await AttributeGroup.insertMany(TAG_GROUPS.map((g, order) => ({ ...g, order })));
  await HelpArticle.insertMany(HELP_ARTICLES.map((a, order) => ({ ...a, section: "Help", order, status: "published" })));
  await BlogPost.insertMany(BLOG_POSTS.map((p) => ({ ...p, author: "Tharkoo", status: "published" })));
  await CreditPack.insertMany(CREDIT_PACKS.map((p, order) => ({ ...p, order, status: "active" })));
  await Banner.insertMany([
    { slot: "dashboard", title: "Launch offer", body: "Buy 500 credits, get 75 extra.", href: "/u/account/credits/", cta: "Buy credits", enabled: true, order: 1 },
  ]);
  await Coupon.insertMany([
    { code: "WELCOME50", label: "50 extra credits", value: "50", expiry: "31 Dec 2026", status: "active" },
  ]);
  await BannedWord.insertMany([{ text: "escortt", matchType: "contains", scope: "title", action: "block" }]);
  await FeatureFlag.insertMany([
    { key: "publishing_packs", label: "Publishing Packs", enabled: true },
    { key: "subscription", label: "Subscription", enabled: true },
    { key: "bank_transfer", label: "Bank transfer", enabled: true },
    { key: "age_gate", label: "18+ gate", enabled: true },
  ]);
  await Product.insertMany([
    { name: "Top", slug: "top", benefits: "Badge + scheduled bumps", credits: 80, status: "active" },
    { name: "Flash", slug: "flash", benefits: "4 hours Available now", credits: 120, status: "active" },
    { name: "Star", slug: "star", benefits: "City star strip slot", credits: 400, status: "active" },
  ]);
  await Page.insertMany([
    { slug: "about", title: "About Tharkoo", body: "Tharkoo is an adult classifieds board for India. Anyone can browse. Verified vendors post. Buyers contact vendors directly. The platform does not take a commission on deals.", status: "published" },
    { slug: "terms", title: "Terms of use", body: "You must be 18+. You may not post illegal content, stolen photos, or demand deposits. Tharkoo is a classifieds board, not a party to meetings.", status: "published" },
    { slug: "privacy", title: "Privacy policy", body: "We store account, ad, and payment records to run the board. Contact data you save stays in your account until you delete it.", status: "published" },
    { slug: "cookies", title: "Cookie policy", body: "Necessary cookies keep the age gate, session and cookie choice. Analytics stay off unless you Accept all.", status: "published" },
    { slug: "grievance", title: "Grievance officer", body: "SparkBeta Tech, Surat. Use Submit a report for takedowns. Include the Ad ID and URLs.", status: "published" },
  ]);

  console.log(`Seeded ${CATEGORIES.length} categories, ${CITIES.length} cities, ${listings.length} listings + CMS`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
