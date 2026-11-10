import { cached } from "./cache";
import { connectDb } from "./db";
import { safeSearch } from "./sanitize";
import {
  AttributeGroup,
  Banner,
  BlogPost,
  Category,
  CreditPack,
  FeatureFlag,
  HelpArticle,
  Listing,
  Location,
  Page,
  SeoTemplate,
  Site,
  type ListingDoc,
} from "./models";

const PAGE_SIZE = 25;
const THIN = 3;

export async function getSite() {
  return cached("site", 15_000, async () => {
    await connectDb();
    return (
      (await Site.findOne({ key: "default" }).lean()) ?? {
        name: "Tharkoo",
        tagline: "Tharkoo, premium classifieds in India.",
        legalName: "SparkBeta Tech",
        countryName: "India",
        supportHours: "Mon–Fri 14:00–20:00 IST",
        ageGateEnabled: true,
      }
    );
  });
}

export async function getCategories() {
  return cached("categories", 30_000, async () => {
    await connectDb();
    return Category.find({ status: "active" }).sort({ order: 1 }).lean();
  });
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
  return cached(`cities:${limit || "all"}`, 30_000, async () => {
    await connectDb();
    const q = Location.find({ kind: "city", status: "active" }).sort({ isTop: -1, name: 1 });
    if (limit) q.limit(limit);
    return q.lean();
  });
}

export async function getTopCities() {
  return cached("top-cities", 30_000, async () => {
    await connectDb();
    return Location.find({ kind: "city", isTop: true, status: "active" }).sort({ sortOrder: 1, name: 1 }).lean();
  });
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
  const safePage = Math.min(Math.max(1, Number(page) || 1), 40);
  return cached(`feed:${JSON.stringify(filter)}:${safePage}`, 10_000, async () => {
    await connectDb();
    const skip = (safePage - 1) * PAGE_SIZE;
    const query = { status: "live", variant: { $ne: "star" }, ...filter };
    const [items, total] = await Promise.all([
      Listing.find(query).sort(rankSort()).skip(skip).limit(PAGE_SIZE).lean(),
      Listing.countDocuments(query),
    ]);
    return { items, total, page: safePage, pageSize: PAGE_SIZE, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  });
}

export async function getListingBySlug(slug: string) {
  if (!slug || slug.length > 160) return null;
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
    const q = safeSearch(opts.q);
    if (q) {
      filter.$and = [
        {
          $or: [
            { title: new RegExp(q, "i") },
            { description: new RegExp(q, "i") },
            { displayName: new RegExp(q, "i") },
            { place: new RegExp(q, "i") },
          ],
        },
      ];
    }
  }
  return getFeed(filter, opts.page ?? 1);
}

export async function listingCountsByCategoryCity() {
  return cached("listing-counts", 30_000, async () => {
    await connectDb();
    return Listing.aggregate<{ _id: { categorySlug: string; citySlug: string }; n: number }>([
      { $match: { status: "live" } },
      { $group: { _id: { categorySlug: "$categorySlug", citySlug: "$citySlug" }, n: { $sum: 1 } } },
    ]);
  });
}

export function isThin(count: number) {
  return count < THIN;
}

export async function getPage(slug: string) {
  await connectDb();
  return Page.findOne({ slug, status: "published" }).lean();
}

export async function getHelpArticles() {
  await connectDb();
  return HelpArticle.find({ status: "published" }).sort({ order: 1 }).lean();
}

export async function getHelp(slug: string) {
  await connectDb();
  return HelpArticle.findOne({ slug, status: "published" }).lean();
}

export async function getBlogPosts() {
  await connectDb();
  return BlogPost.find({ status: "published" }).lean();
}

export async function getBlog(slug: string) {
  await connectDb();
  return BlogPost.findOne({ slug, status: "published" }).lean();
}

export async function getCreditPacks() {
  await connectDb();
  return CreditPack.find({ status: "active" }).sort({ order: 1 }).lean();
}

export async function getBanners(slot?: string) {
  await connectDb();
  const q = slot ? { slot, enabled: true } : { enabled: true };
  return Banner.find(q).sort({ order: 1 }).lean();
}

export async function getFlags() {
  await connectDb();
  return FeatureFlag.find().lean();
}

export async function getAttributeGroups() {
  await connectDb();
  return AttributeGroup.find().sort({ order: 1 }).lean();
}

export { PAGE_SIZE };
