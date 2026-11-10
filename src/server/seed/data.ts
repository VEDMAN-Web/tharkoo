import type { CategoryFieldDoc } from "@/server/models";

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
  ["gurugram", "Gurugram", "haryana"],
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

/** Districts for the ten largest cities only. */
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
] as const;

/** Default INR table. Override with SEED_CREDIT_PACKS, a JSON array of the same shape. Prices are rupees. */
export const DEFAULT_CREDIT_PACKS: readonly SeedCreditPack[] = [
  { credits: 100, price: 1000, bonus: 0, tag: "", order: 0 },
  { credits: 200, price: 1900, bonus: 10, tag: "", order: 1 },
  { credits: 300, price: 2700, bonus: 30, tag: "", order: 2 },
  { credits: 500, price: 4250, bonus: 75, tag: "Most popular", order: 3 },
  { credits: 800, price: 6400, bonus: 160, tag: "", order: 4 },
  { credits: 1000, price: 7500, bonus: 250, tag: "Best deal", order: 5 },
  { credits: 1500, price: 10500, bonus: 450, tag: "", order: 6 },
  { credits: 2000, price: 13000, bonus: 700, tag: "", order: 7 },
  { credits: 3000, price: 18000, bonus: 1200, tag: "", order: 8 },
  { credits: 5000, price: 27500, bonus: 2250, tag: "", order: 9 },
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
    if (!TOP_CITY_SLUGS.includes(slug as (typeof TOP_CITY_SLUGS)[number])) {
      throw new Error(`Districts are only seeded for the top 10 cities (${slug})`);
    }
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
}

assertCatalogue();
