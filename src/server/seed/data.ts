import type { CategoryFieldDoc } from "@/server/models";
import { TAG_PAGES } from "@/data/catalog";
import { textDenied } from "@/server/shared/policy";

export const LOCATION_LEVELS = ["country", "state", "city", "district", "locality"] as const;

export const SEED_BATCH = "seed-2026-11-10";

export interface SeedField {
  key: string;
  label: string;
  type: CategoryFieldDoc["type"];
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
  unit?: string;
  order: number;
  enabled: boolean;
}

export interface SeedCategory {
  slug: string;
  name: string;
  description: string;
  order: number;
  enabled: boolean;
  fields: SeedField[];
}

export interface SeedCreditPack {
  credits: number;
  price: number;
  bonus: number;
  tag: string;
  order: number;
}

type FieldRow = [string, string, SeedField["type"], Partial<SeedField>?];

function fields(rows: FieldRow[]): SeedField[] {
  return rows.map(([key, label, type, extra], order) => ({
    key,
    label,
    type,
    required: false,
    enabled: true,
    ...extra,
    order,
  }));
}

/** Neutral allow-list. Administrators can add more later; this seed does not. */
export const CATEGORIES: SeedCategory[] = [
  {
    slug: "dating",
    name: "Dating",
    description: "Dating notices for people who want to meet.",
    order: 0,
    enabled: true,
    fields: fields([
      ["age", "Age", "number", { required: true, min: 18, max: 120 }],
      ["looking-for", "Looking for", "select", { required: true, options: ["Coffee", "Events", "Long term"] }],
    ]),
  },
  {
    slug: "friendship",
    name: "Friendship",
    description: "Friendship and social notices.",
    order: 1,
    enabled: true,
    fields: fields([["interest", "Interest", "text", { required: true }]]),
  },
  {
    slug: "meetups",
    name: "Meetups",
    description: "Local meetups and group activities.",
    order: 2,
    enabled: true,
    fields: fields([
      ["topic", "Topic", "text", { required: true }],
      ["when", "When", "date"],
    ]),
  },
  {
    slug: "personal-ads",
    name: "Personal ads",
    description: "Short personal notices for dating, friendship, and activities.",
    order: 3,
    enabled: true,
    fields: fields([["topic", "Topic", "text", { required: true }]]),
  },
  {
    slug: "jobs",
    name: "Jobs",
    description: "Job posts and roles for hire.",
    order: 4,
    enabled: true,
    fields: fields([
      ["role", "Role", "text", { required: true }],
      ["work-mode", "Work mode", "select", { options: ["Office", "Remote", "Hybrid"] }],
    ]),
  },
  {
    slug: "wellness",
    name: "Wellness",
    description: "Spa, massage, yoga, and fitness bookings.",
    order: 5,
    enabled: true,
    fields: fields([
      ["kind", "Kind", "select", { required: true, options: ["Spa", "Massage", "Yoga", "Fitness"] }],
    ]),
  },
  {
    slug: "property",
    name: "Property",
    description: "Homes, plots, and other property.",
    order: 6,
    enabled: true,
    fields: fields([
      ["kind", "Kind", "select", { required: true, options: ["Apartment", "House", "Plot", "Commercial"] }],
      ["purpose", "Purpose", "select", { required: true, options: ["Sale", "Rent"] }],
    ]),
  },
  {
    slug: "vehicles",
    name: "Vehicles",
    description: "Cars, bikes, and other vehicles.",
    order: 7,
    enabled: true,
    fields: fields([
      ["make", "Make", "text", { required: true }],
      ["year", "Year", "number", { required: true, min: 1900, max: 2100 }],
      ["km", "Distance", "number", { min: 0, unit: "km" }],
    ]),
  },
  {
    slug: "buy-and-sell",
    name: "Buy and sell",
    description: "Goods for sale from one person to another.",
    order: 8,
    enabled: true,
    fields: fields([["condition", "Condition", "select", { required: true, options: ["New", "Used"] }]]),
  },
  {
    slug: "pets",
    name: "Pets",
    description: "Pets and pet supplies.",
    order: 9,
    enabled: true,
    fields: fields([["kind", "Kind", "select", { options: ["Dog", "Cat", "Supplies"] }]]),
  },
  {
    slug: "education",
    name: "Education",
    description: "Classes, tutoring, and courses.",
    order: 10,
    enabled: true,
    fields: fields([
      ["subject", "Subject", "text", { required: true }],
      ["mode", "Mode", "select", { options: ["In person", "Online"] }],
    ]),
  },
];

/** 28 states and 8 union territories. */
export const STATES: ReadonlyArray<readonly [string, string]> = [
  ["andhra-pradesh", "Andhra Pradesh"],
  ["arunachal-pradesh", "Arunachal Pradesh"],
  ["assam", "Assam"],
  ["bihar", "Bihar"],
  ["chhattisgarh", "Chhattisgarh"],
  ["goa", "Goa"],
  ["gujarat", "Gujarat"],
  ["haryana", "Haryana"],
  ["himachal-pradesh", "Himachal Pradesh"],
  ["jharkhand", "Jharkhand"],
  ["karnataka", "Karnataka"],
  ["kerala", "Kerala"],
  ["madhya-pradesh", "Madhya Pradesh"],
  ["maharashtra", "Maharashtra"],
  ["manipur", "Manipur"],
  ["meghalaya", "Meghalaya"],
  ["mizoram", "Mizoram"],
  ["nagaland", "Nagaland"],
  ["odisha", "Odisha"],
  ["punjab", "Punjab"],
  ["rajasthan", "Rajasthan"],
  ["sikkim", "Sikkim"],
  ["tamil-nadu", "Tamil Nadu"],
  ["telangana", "Telangana"],
  ["tripura", "Tripura"],
  ["uttar-pradesh", "Uttar Pradesh"],
  ["uttarakhand", "Uttarakhand"],
  ["west-bengal", "West Bengal"],
  ["andaman-and-nicobar-islands", "Andaman and Nicobar Islands"],
  ["chandigarh", "Chandigarh"],
  ["dadra-and-nagar-haveli-and-daman-and-diu", "Dadra and Nagar Haveli and Daman and Diu"],
  ["delhi", "Delhi"],
  ["jammu-and-kashmir", "Jammu and Kashmir"],
  ["ladakh", "Ladakh"],
  ["lakshadweep", "Lakshadweep"],
  ["puducherry", "Puducherry"],
];

/** City slug, name, state slug. */
export const CITIES: ReadonlyArray<readonly [string, string, string]> = [
  ["mumbai", "Mumbai", "maharashtra"],
  ["delhi", "Delhi", "delhi"],
  ["bengaluru", "Bengaluru", "karnataka"],
  ["hyderabad", "Hyderabad", "telangana"],
  ["ahmedabad", "Ahmedabad", "gujarat"],
  ["chennai", "Chennai", "tamil-nadu"],
  ["kolkata", "Kolkata", "west-bengal"],
  ["surat", "Surat", "gujarat"],
  ["pune", "Pune", "maharashtra"],
  ["jaipur", "Jaipur", "rajasthan"],
  ["visakhapatnam", "Visakhapatnam", "andhra-pradesh"],
  ["vijayawada", "Vijayawada", "andhra-pradesh"],
  ["itanagar", "Itanagar", "arunachal-pradesh"],
  ["guwahati", "Guwahati", "assam"],
  ["patna", "Patna", "bihar"],
  ["raipur", "Raipur", "chhattisgarh"],
  ["panaji", "Panaji", "goa"],
  ["vadodara", "Vadodara", "gujarat"],
  ["rajkot", "Rajkot", "gujarat"],
  ["gurgaon", "Gurgaon", "haryana"],
  ["faridabad", "Faridabad", "haryana"],
  ["shimla", "Shimla", "himachal-pradesh"],
  ["ranchi", "Ranchi", "jharkhand"],
  ["mysuru", "Mysuru", "karnataka"],
  ["kochi", "Kochi", "kerala"],
  ["thiruvananthapuram", "Thiruvananthapuram", "kerala"],
  ["indore", "Indore", "madhya-pradesh"],
  ["bhopal", "Bhopal", "madhya-pradesh"],
  ["nagpur", "Nagpur", "maharashtra"],
  ["nashik", "Nashik", "maharashtra"],
  ["thane", "Thane", "maharashtra"],
  ["imphal", "Imphal", "manipur"],
  ["shillong", "Shillong", "meghalaya"],
  ["aizawl", "Aizawl", "mizoram"],
  ["kohima", "Kohima", "nagaland"],
  ["bhubaneswar", "Bhubaneswar", "odisha"],
  ["ludhiana", "Ludhiana", "punjab"],
  ["amritsar", "Amritsar", "punjab"],
  ["jodhpur", "Jodhpur", "rajasthan"],
  ["udaipur", "Udaipur", "rajasthan"],
  ["gangtok", "Gangtok", "sikkim"],
  ["coimbatore", "Coimbatore", "tamil-nadu"],
  ["madurai", "Madurai", "tamil-nadu"],
  ["warangal", "Warangal", "telangana"],
  ["agartala", "Agartala", "tripura"],
  ["lucknow", "Lucknow", "uttar-pradesh"],
  ["kanpur", "Kanpur", "uttar-pradesh"],
  ["noida", "Noida", "uttar-pradesh"],
  ["varanasi", "Varanasi", "uttar-pradesh"],
  ["dehradun", "Dehradun", "uttarakhand"],
  ["siliguri", "Siliguri", "west-bengal"],
  ["port-blair", "Port Blair", "andaman-and-nicobar-islands"],
  ["chandigarh", "Chandigarh", "chandigarh"],
  ["silvassa", "Silvassa", "dadra-and-nagar-haveli-and-daman-and-diu"],
  ["srinagar", "Srinagar", "jammu-and-kashmir"],
  ["jammu", "Jammu", "jammu-and-kashmir"],
  ["leh", "Leh", "ladakh"],
  ["kavaratti", "Kavaratti", "lakshadweep"],
  ["puducherry", "Puducherry", "puducherry"],
];

export const TOP_CITY_SLUGS = [
  "mumbai",
  "delhi",
  "bengaluru",
  "hyderabad",
  "ahmedabad",
  "chennai",
  "kolkata",
  "surat",
  "pune",
  "jaipur",
] as const;

/** Districts for the ten largest cities, plus Gurgaon. */
export const DISTRICTS: Record<string, ReadonlyArray<readonly [string, string]>> = {
  mumbai: [
    ["mumbai-city", "Mumbai City"],
    ["mumbai-suburban", "Mumbai Suburban"],
  ],
  delhi: [
    ["new-delhi", "New Delhi"],
    ["central-delhi", "Central Delhi"],
    ["south-delhi", "South Delhi"],
  ],
  bengaluru: [
    ["bengaluru-urban", "Bengaluru Urban"],
    ["bengaluru-rural", "Bengaluru Rural"],
  ],
  hyderabad: [
    ["hyderabad-district", "Hyderabad"],
    ["rangareddy", "Rangareddy"],
  ],
  ahmedabad: [
    ["ahmedabad-city", "Ahmedabad City"],
    ["daskroi", "Daskroi"],
  ],
  chennai: [["chennai-district", "Chennai"]],
  kolkata: [["kolkata-district", "Kolkata"]],
  surat: [
    ["surat-city", "Surat City"],
    ["choryasi", "Choryasi"],
  ],
  pune: [
    ["pune-city", "Pune City"],
    ["haveli", "Haveli"],
  ],
  jaipur: [["jaipur-city", "Jaipur City"]],
  gurgaon: [
    ["gurgaon-dlf", "DLF"],
    ["sohna-road", "Sohna Road"],
    ["golf-course-road", "Golf Course Road"],
    ["mg-road-gurgaon", "MG Road"],
    ["cyber-city", "Cyber City"],
    ["sector-29-gurgaon", "Sector 29"],
  ],
};

/** Amounts are INR rupees. Codes stay inside ALLOWED_PRODUCT_CODES. */
export const PRODUCTS = [
  { code: "free", name: "Free", description: "A standard listing with no promotion charge.", amount: 0, currency: "INR", durationDays: 7 },
  { code: "top", name: "TOP", description: "Placement at the top of results for seven days.", amount: 499, currency: "INR", durationDays: 7 },
  { code: "auto-boost", name: "Auto Boost", description: "Ten automatic boosts across six hours.", amount: 299, currency: "INR", durationDays: 1 },
  { code: "super-top", name: "Super Top", description: "Highest placement in a city for seven days.", amount: 999, currency: "INR", durationDays: 7 },
  { code: "highlight", name: "Highlight", description: "A highlighted listing card for three days.", amount: 199, currency: "INR", durationDays: 3 },
  { code: "new", name: "New", description: "A new-listing label for seven days.", amount: 99, currency: "INR", durationDays: 7 },
  { code: "flash", name: "Flash", description: "A short flash label for four hours.", amount: 149, currency: "INR", durationDays: 1 },
  { code: "star", name: "Star", description: "A premium slot on a city page.", amount: 799, currency: "INR", durationDays: 7 },
  { code: "bump", name: "Bump", description: "Refresh this ad so it sorts with the newest posts.", amount: 49, currency: "INR", durationDays: 1 },
] as const;

/** Default INR table. Override with SEED_CREDIT_PACKS, a JSON array of the same shape. Prices are rupees. */
export const DEFAULT_CREDIT_PACKS: readonly SeedCreditPack[] = [
  { credits: 100, price: 1000, bonus: 0, tag: "", order: 0 },
  { credits: 200, price: 1900, bonus: 10, tag: "Extra credits", order: 1 },
  { credits: 300, price: 2700, bonus: 30, tag: "Extra credits", order: 2 },
  { credits: 500, price: 4250, bonus: 75, tag: "Most popular", order: 3 },
  { credits: 800, price: 6400, bonus: 160, tag: "Extra credits", order: 4 },
  { credits: 1000, price: 7500, bonus: 250, tag: "Best deal", order: 5 },
  { credits: 1500, price: 10500, bonus: 450, tag: "Extra credits", order: 6 },
  { credits: 2000, price: 13000, bonus: 700, tag: "Extra credits", order: 7 },
  { credits: 3000, price: 18000, bonus: 1200, tag: "Extra credits", order: 8 },
  { credits: 5000, price: 27500, bonus: 2250, tag: "Extra credits", order: 9 },
];

export const FEATURE_FLAGS = [
  { key: "payments-mock", label: "Payments use the mock provider", enabled: true },
  { key: "phone-otp", label: "Phone codes stay in test mode", enabled: false },
  { key: "site-noindex", label: "Public pages stay out of search indexes", enabled: true },
  { key: "kyc-required", label: "Identity review is required before the first publish", enabled: true },
] as const;

function isPack(value: unknown): value is SeedCreditPack {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.credits === "number" &&
    typeof row.price === "number" &&
    typeof row.bonus === "number" &&
    typeof row.tag === "string" &&
    typeof row.order === "number"
  );
}

export function creditPackTable(): SeedCreditPack[] {
  const raw = process.env.SEED_CREDIT_PACKS;
  if (!raw) return DEFAULT_CREDIT_PACKS.map((row) => ({ ...row }));
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("SEED_CREDIT_PACKS must be JSON");
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isPack)) {
    throw new Error("SEED_CREDIT_PACKS must be a non-empty array of credit packs");
  }
  return parsed;
}

const ADS_PER_TOP_CATEGORY = 16;
const ADS_PER_OTHER_CITY = 12;
export const SEED_USER_EMAIL = "seed@tharkoo.local";

const DEMO_LINES: Record<string, ReadonlyArray<readonly [string, string, Record<string, string | number>]>> = {
  dating: [
    ["Coffee in {city}", "Looking to meet for coffee and a walk around {city}.", { age: 29, "looking-for": "Coffee" }],
    ["Weekend events in {city}", "Interested in local events and a steady chat in {city}.", { age: 34, "looking-for": "Events" }],
    ["Long term dating in {city}", "Hoping to meet someone for a long term relationship in {city}.", { age: 31, "looking-for": "Long term" }],
  ],
  friendship: [
    ["Weekend hiking friend in {city}", "Looking for a hiking friend on weekend mornings in {city}.", { interest: "Hiking" }],
    ["Board games in {city}", "Friendly board game group looking for new people in {city}.", { interest: "Board games" }],
    ["Language exchange in {city}", "Want a language exchange partner in {city}.", { interest: "Languages" }],
  ],
  meetups: [
    ["Morning walk meetup in {city}", "A small morning walk group meets in {city}.", { topic: "Morning walk" }],
    ["Book club meetup in {city}", "Monthly book club for general fiction in {city}.", { topic: "Books" }],
    ["Photography meetup in {city}", "Casual photography walk for beginners in {city}.", { topic: "Photography" }],
  ],
  "personal-ads": [
    ["New in {city}", "Recently moved to {city} and would like local friends.", { topic: "New in town" }],
    ["Music fan in {city}", "Looking to share live music plans in {city}.", { topic: "Music" }],
    ["Cooking club in {city}", "Home cooking notes and recipe swaps in {city}.", { topic: "Cooking" }],
  ],
  jobs: [
    ["Office assistant in {city}", "Weekday office assistant role for a local team in {city}.", { role: "Office assistant", "work-mode": "Office" }],
    ["Shop helper in {city}", "Daytime shop helper role in {city}.", { role: "Shop helper", "work-mode": "Office" }],
    ["Data entry from {city}", "Remote data entry for a small firm based in {city}.", { role: "Data entry", "work-mode": "Remote" }],
  ],
  wellness: [
    ["Yoga class in {city}", "Morning yoga class for beginners in {city}.", { kind: "Yoga" }],
    ["Fitness coaching in {city}", "Fitness coaching slots at a local gym in {city}.", { kind: "Fitness" }],
    ["Spa booking in {city}", "Spa appointment slots available in {city}.", { kind: "Spa" }],
  ],
  property: [
    ["Apartment for rent in {city}", "Two bedroom apartment for rent in {city}.", { kind: "Apartment", purpose: "Rent" }],
    ["House for sale in {city}", "Independent house for sale in {city}.", { kind: "House", purpose: "Sale" }],
    ["Plot for sale in {city}", "Residential plot for sale near {city}.", { kind: "Plot", purpose: "Sale" }],
  ],
  vehicles: [
    ["Used hatchback in {city}", "A used hatchback kept in a covered garage in {city}.", { make: "Hatchback", year: 2018, km: 42000 }],
    ["City bike in {city}", "A commuter bike with workshop records in {city}.", { make: "Commuter", year: 2020, km: 12000 }],
    ["Family car in {city}", "Family car with a full workshop history in {city}.", { make: "Sedan", year: 2016, km: 61000 }],
  ],
  "buy-and-sell": [
    ["Wooden desk in {city}", "A used wooden desk for sale in {city}.", { condition: "Used" }],
    ["New water bottle in {city}", "A new steel water bottle for sale in {city}.", { condition: "New" }],
    ["Bookshelf in {city}", "A used bookshelf for sale, buyer collects in {city}.", { condition: "Used" }],
  ],
  pets: [
    ["Dog supplies in {city}", "Unused dog supplies for sale in {city}.", { kind: "Supplies" }],
    ["Cat carrier in {city}", "A cat carrier in good condition in {city}.", { kind: "Supplies" }],
    ["Pet bowls in {city}", "Spare pet bowls from a household in {city}.", { kind: "Supplies" }],
  ],
  education: [
    ["Maths tutoring in {city}", "After school maths tutoring in {city}.", { subject: "Maths", mode: "In person" }],
    ["English class in {city}", "Spoken English class for learners in {city}.", { subject: "English", mode: "In person" }],
    ["Online science tutoring", "Online science tutoring from a tutor in {city}.", { subject: "Science", mode: "Online" }],
  ],
};

const DEMO_PROMOTIONS = ["star", "top", "super-top", "highlight", "new", "flash"] as const;

export interface DemoListing {
  slug: string;
  title: string;
  description: string;
  categorySlug: string;
  citySlug: string;
  districtSlug?: string;
  attributes: Record<string, string | number>;
  verified: boolean;
  promotionCode?: (typeof DEMO_PROMOTIONS)[number];
  bumped: boolean;
}

export function demoListings(): DemoListing[] {
  const out: DemoListing[] = [];
  const top = new Set<string>(TOP_CITY_SLUGS);
  let n = 0;
  const push = (
    city: (typeof CITIES)[number],
    category: (typeof CATEGORIES)[number],
    districtSlug: string | undefined,
    promotionCode?: DemoListing["promotionCode"],
  ) => {
    const lines = DEMO_LINES[category.slug];
    const line = lines?.[n % (lines?.length ?? 1)];
    if (!line) throw new Error(`No demo copy for ${category.slug}`);
    const [titleTemplate, descriptionTemplate, attributes] = line;
    out.push({
      slug: `demo-${String(n).padStart(4, "0")}`,
      title: titleTemplate.split("{city}").join(city[1]),
      description: descriptionTemplate.split("{city}").join(city[1]),
      categorySlug: category.slug,
      citySlug: city[0],
      districtSlug,
      attributes: { ...attributes, tag: TAG_PAGES[n % TAG_PAGES.length]?.slug || "individual" },
      verified: n % 5 === 0,
      promotionCode,
      bumped: n % 17 === 0,
    });
    n += 1;
  };
  for (const city of CITIES) {
    const districts = DISTRICTS[city[0]] ?? [];
    if (top.has(city[0])) {
      for (const category of CATEGORIES) {
        for (let k = 0; k < ADS_PER_TOP_CATEGORY; k += 1) {
          const district = districts[k % Math.max(1, districts.length)];
          const promotionCode =
            category.slug === "dating" && k < DEMO_PROMOTIONS.length ? DEMO_PROMOTIONS[k] : undefined;
          push(city, category, district?.[0], promotionCode);
        }
      }
    } else {
      for (const category of CATEGORIES) {
        for (let k = 0; k < ADS_PER_OTHER_CITY; k += 1) {
          const district = districts[k % Math.max(1, districts.length)];
          push(city, category, district?.[0], category.slug === "dating" && k === 0 ? "top" : undefined);
        }
      }
    }
  }
  return out;
}

export const DEMO_LISTING_COUNT = demoListings().length;

export interface SeedCounts {
  states: number;
  cities: number;
  districts: number;
  citiesWithDistricts: number;
  locations: number;
  categories: number;
  promotion_products: number;
  credit_packs: number;
  feature_flags: number;
  listings: number;
}

export function expectedSeedCounts(): SeedCounts {
  let districts = 0;
  let citiesWithDistricts = 0;
  for (const city of CITIES) {
    const rows = DISTRICTS[city[0]] ?? [];
    if (rows.length > 0) citiesWithDistricts += 1;
    districts += rows.length;
  }
  return {
    states: STATES.length,
    cities: CITIES.length,
    districts,
    citiesWithDistricts,
    locations: 1 + STATES.length + CITIES.length + districts,
    categories: CATEGORIES.length,
    promotion_products: PRODUCTS.length,
    credit_packs: creditPackTable().length,
    feature_flags: FEATURE_FLAGS.length,
    listings: DEMO_LISTING_COUNT,
  };
}

function assertCatalogue(): void {
  if (STATES.length !== 36) throw new Error("India seed must list 36 states and union territories");
  const stateSlugs = new Set(STATES.map((row) => row[0]));
  if (stateSlugs.size !== STATES.length) throw new Error("Duplicate state slug");
  const citySlugs = CITIES.map((row) => row[0]);
  if (new Set(citySlugs).size !== citySlugs.length) throw new Error("Duplicate city slug");
  for (const [, , stateSlug] of CITIES) {
    if (!stateSlugs.has(stateSlug)) throw new Error(`City refers to unknown state ${stateSlug}`);
  }
  if (TOP_CITY_SLUGS.length !== 10) throw new Error("Top city list must have 10 entries");
  const districtSlugs: string[] = [];
  for (const slug of Object.keys(DISTRICTS)) {
    if (!citySlugs.includes(slug)) throw new Error(`Districts refer to unknown city ${slug}`);
    for (const [districtSlug] of DISTRICTS[slug] ?? []) districtSlugs.push(districtSlug);
  }
  for (const slug of TOP_CITY_SLUGS) {
    if (!DISTRICTS[slug]?.length) throw new Error(`Missing districts for ${slug}`);
  }
  if (new Set(districtSlugs).size !== districtSlugs.length) throw new Error("Duplicate district slug");
  const categorySlugs = CATEGORIES.map((category) => category.slug);
  if (new Set(categorySlugs).size !== categorySlugs.length) throw new Error("Duplicate category slug");
  const productCodes = PRODUCTS.map((product) => product.code);
  if (new Set(productCodes).size !== productCodes.length) throw new Error("Duplicate product code");
  for (const row of demoListings()) {
    if (textDenied(`${row.title} ${row.description}`).denied) {
      throw new Error(`Demo listing text refused: ${row.slug}`);
    }
  }
}

assertCatalogue();
