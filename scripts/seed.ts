import mongoose from "mongoose";
import { CATEGORIES, CITY_STATE, CITIES, DISTRICTS, TOP_CITIES } from "../src/data/catalog";
import { DEFAULT_SEO } from "../src/lib/seo";
import { slugify } from "../src/lib/utils";
import { Category, Listing, Location, SeoTemplate, Site } from "../src/lib/models";

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
  ]);

  await Site.create({
    key: "default",
    name: "Tharkoo",
    tagline:
      "Welcome to Tharkoo. Browse Call Girls, Massages, Male Escorts, Transsexual and Adult Meetings across Indian cities. Post your ad absolutely FREE.",
    legalName: "SparkBeta Tech",
    countryName: "India",
    supportHours: "Mon–Fri 14:00–20:00 IST",
    ageGateEnabled: true,
  });

  await SeoTemplate.insertMany(Object.values(DEFAULT_SEO));
  await Category.insertMany([...CATEGORIES]);

  await Location.create({ kind: "country", name: "India", slug: "india", status: "active" });

  const states = [...new Set(Object.values(CITY_STATE))];
  await Location.insertMany(
    states.map((name) => ({
      kind: "state",
      name,
      slug: slugify(name),
      parentSlug: "india",
      status: "active",
    })),
  );

  await Location.insertMany(
    CITIES.map((name) => ({
      kind: "city",
      name,
      slug: slugify(name),
      parentSlug: slugify(CITY_STATE[name]),
      stateSlug: slugify(CITY_STATE[name]),
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
      stateSlug: slugify(CITY_STATE[city]),
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
          stateSlug: slugify(CITY_STATE[city]),
          citySlug: slugify(city),
          districtSlug: district ? slugify(district) : undefined,
          place: district || "City-wide",
          chips: [`${22 + ((i + n) % 16)} years`, city],
          photos: hasPhotos ? [`initial:${name[0]}`] : [],
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
          tags: { tag1: "Other", tag2: ["This week"] },
        });
        i += 1;
      }
    }
  }
  await Listing.insertMany(listings);

  console.log(`Seeded ${CATEGORIES.length} categories, ${CITIES.length} cities, ${listings.length} listings`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
