import { connectDb } from "./db";
import { Category, Listing, Location, SeoTemplate, Site, type ListingDoc } from "./models";

const PAGE_SIZE = 25;
const THIN = 3;

export async function getSite() {
  await connectDb();
  return (
    (await Site.findOne({ key: "default" }).lean()) ?? {
      name: "Tharkoo",
      tagline: "Classifieds in your city",
      legalName: "SparkBeta Tech",
      countryName: "India",
      supportHours: "Mon–Fri 14:00–20:00 IST",
      ageGateEnabled: true,
    }
  );
}

export async function getCategories() {
  await connectDb();
  return Category.find({ status: "active" }).sort({ order: 1 }).lean();
}

export async function getCategory(slug: string) {
  await connectDb();
  return Category.findOne({ slug, status: "active" }).lean();
}

export async function getLocationBySlug(slug: string) {
  await connectDb();
  return Location.findOne({ slug, status: "active" }).lean();
}

export async function getCities(limit?: number) {
  await connectDb();
  const q = Location.find({ kind: "city", status: "active" }).sort({ isTop: -1, name: 1 });
  if (limit) q.limit(limit);
  return q.lean();
}

export async function getTopCities() {
  await connectDb();
  return Location.find({ kind: "city", isTop: true, status: "active" }).sort({ name: 1 }).lean();
}

export async function getSiblingCities(stateSlug: string) {
  await connectDb();
  return Location.find({ kind: "city", stateSlug, status: "active" }).sort({ name: 1 }).lean();
}

export async function getDistricts(citySlug: string) {
  await connectDb();
  return Location.find({ kind: "district", citySlug, status: "active" }).sort({ name: 1 }).lean();
}

export async function getStates() {
  await connectDb();
  return Location.find({ kind: "state", status: "active" }).sort({ name: 1 }).lean();
}

export async function getSeo(pageType: string) {
  await connectDb();
  return SeoTemplate.findOne({ pageType }).lean();
}

function rankSort() {
  return { lastBumpedAt: -1 as const, publicId: 1 as const };
}

export async function countListings(filter: Record<string, unknown>) {
  await connectDb();
  return Listing.countDocuments({ status: "live", ...filter });
}

export async function getStarListings(filter: Record<string, unknown>, limit = 6) {
  await connectDb();
  return Listing.find({ status: "live", variant: "star", ...filter })
    .sort(rankSort())
    .limit(limit)
    .lean();
}

export async function getFeed(filter: Record<string, unknown>, page = 1) {
  await connectDb();
  const skip = (page - 1) * PAGE_SIZE;
  const query = { status: "live", variant: { $ne: "star" }, ...filter };
  const [items, total] = await Promise.all([
    Listing.find(query).sort(rankSort()).skip(skip).limit(PAGE_SIZE).lean(),
    Listing.countDocuments(query),
  ]);
  return { items, total, page, pageSize: PAGE_SIZE, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getListingBySlug(slug: string) {
  await connectDb();
  const publicId = slug.split("-").pop() || "";
  return Listing.findOne({
    status: { $in: ["live", "live-promoted"] },
    $or: [{ slug }, { publicId }],
  }).lean();
}

export async function getRelated(listing: ListingDoc, limit = 6) {
  await connectDb();
  return Listing.find({
    status: "live",
    categorySlug: listing.categorySlug,
    citySlug: listing.citySlug,
    publicId: { $ne: listing.publicId },
  })
    .sort(rankSort())
    .limit(limit)
    .lean();
}

export async function searchListings(opts: {
  q?: string;
  category?: string;
  location?: string;
  photos?: boolean;
  verified?: boolean;
  page?: number;
}) {
  await connectDb();
  const filter: Record<string, unknown> = { status: "live" };
  if (opts.category) filter.categorySlug = opts.category;
  if (opts.location) {
    filter.$or = [{ citySlug: opts.location }, { stateSlug: opts.location }, { districtSlug: opts.location }];
  }
  if (opts.photos) filter.photos = { $exists: true, $ne: [] };
  if (opts.verified) filter.verified = true;
  if (opts.q) {
    filter.$and = [
      {
        $or: [
          { title: new RegExp(opts.q, "i") },
          { description: new RegExp(opts.q, "i") },
          { displayName: new RegExp(opts.q, "i") },
          { place: new RegExp(opts.q, "i") },
        ],
      },
    ];
  }
  return getFeed(filter, opts.page ?? 1);
}

export async function listingCountsByCategoryCity() {
  await connectDb();
  return Listing.aggregate<{ _id: { categorySlug: string; citySlug: string }; n: number }>([
    { $match: { status: "live" } },
    { $group: { _id: { categorySlug: "$categorySlug", citySlug: "$citySlug" }, n: { $sum: 1 } } },
  ]);
}

export function isThin(count: number) {
  return count < THIN;
}

export { PAGE_SIZE };
