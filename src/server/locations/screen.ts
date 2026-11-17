import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { picturesOf, type PicturesView } from "@/server/layout/catalog-pictures";
import { Listing, Location, type LocationLevel } from "@/server/models";

/**
 * H8.52: everything the Cities & areas screen reads. A searchable, paged list of EVERY place (cities first, then states,
 * then countries), and the full detail of the place the address names. Nothing here writes.
 */

export const PLACE_PAGE_SIZE = 30;
export const PLACE_PAGE_MAX = 100;
const SEARCH_MAX = 80;
const MANAGED: LocationLevel[] = ["city", "state", "country"];
const AREA_TYPES: LocationLevel[] = ["district", "locality"];
const RANK: Record<string, number> = { city: 0, state: 1, country: 2 };

export type PlaceRowView = {
  id: string;
  slug: string;
  name: string;
  type: "city" | "state" | "country";
  /** The place it is inside: the state of a city, the country of a state. Empty for a country. */
  where: string;
  enabled: boolean;
  /** Address of the Home page tile picture, empty when none. */
  thumb: string;
};

export type PlaceAreaView = { id: string; slug: string; name: string; type: "district" | "locality"; enabled: boolean; parentName: string };

export type PlaceDetailView = {
  id: string;
  type: "city" | "state" | "country";
  slug: string;
  name: string;
  parentId: string;
  where: string;
  countryCode: string;
  order: number;
  enabled: boolean;
  pictures: PicturesView;
  /** Ads in this place. Null for a country, which has no ad link. */
  adCount: number | null;
  /** Places directly inside it (cities of a state, states of a country, districts of a city). */
  childCount: number;
  /** Districts and localities of a city. Empty for a state or a country. */
  areas: PlaceAreaView[];
  /** The public address of the page for this place. Empty for a state, which has no page of its own. */
  publicPath: string;
};

export type PlacesQuery = { q?: string; page?: number; pageSize?: number; id?: string };

export type PlacesScreenData = {
  rows: PlaceRowView[];
  total: number;
  page: number;
  pages: number;
  pageSize: number;
  q: string;
  detail: PlaceDetailView | null;
  /** True when the address named a place that exists; false when the first row is shown by default. */
  chosen: boolean;
};

type Lean = {
  _id: Types.ObjectId;
  type: LocationLevel;
  slug: string;
  name: string;
  parentId?: Types.ObjectId | null;
  enabled?: boolean;
  order?: number;
  countryCode?: string;
  photo?: never;
  band?: never;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parsePlacesQuery(params: Record<string, string | string[] | undefined>): Required<PlacesQuery> {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const page = Math.floor(Number(one("page")));
  const size = Math.floor(Number(one("size")));
  return {
    q: one("q").trim().slice(0, SEARCH_MAX),
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    pageSize: Number.isFinite(size) && size >= 1 ? Math.min(size, PLACE_PAGE_MAX) : PLACE_PAGE_SIZE,
    id: one("place").trim().slice(0, 40),
  };
}

async function parentNames(parentIds: (Types.ObjectId | null | undefined)[]): Promise<Map<string, string>> {
  const ids = [...new Set(parentIds.filter((value): value is Types.ObjectId => Boolean(value)).map(String))];
  if (ids.length === 0) return new Map();
  const rows = await Location.find({ _id: { $in: ids } }).select("name").lean<{ _id: Types.ObjectId; name: string }[]>();
  return new Map(rows.map((row) => [String(row._id), row.name]));
}

async function adCountOf(doc: Lean): Promise<number | null> {
  if (doc.type === "city") return Listing.countDocuments({ cityId: doc._id });
  if (doc.type === "state") return Listing.countDocuments({ stateId: doc._id });
  return null;
}

async function detailOf(doc: Lean, pictures: PicturesView, where: string): Promise<PlaceDetailView> {
  const [adCount, childCount, areaDocs] = await Promise.all([
    adCountOf(doc),
    Location.countDocuments({ parentId: doc._id }),
    doc.type === "city" ? Location.find({ parentId: doc._id, type: { $in: AREA_TYPES } }).select("slug name type enabled").sort({ type: 1, name: 1 }).collation({ locale: "en", strength: 2 }).limit(500).lean<{ _id: Types.ObjectId; slug: string; name: string; type: "district" | "locality"; enabled?: boolean }[]>() : Promise.resolve([]),
  ]);
  return {
    id: String(doc._id),
    type: doc.type as PlaceDetailView["type"],
    slug: doc.slug,
    name: doc.name,
    parentId: doc.parentId ? String(doc.parentId) : "",
    where,
    countryCode: doc.countryCode ?? "",
    order: doc.order ?? 0,
    enabled: doc.enabled !== false,
    pictures,
    adCount,
    childCount,
    areas: areaDocs.map((row) => ({ id: String(row._id), slug: row.slug, name: row.name, type: row.type, enabled: row.enabled !== false, parentName: doc.name })),
    publicPath: doc.type === "city" ? `/cities/${doc.slug}/` : doc.type === "country" ? `/countries/${doc.slug}/` : "",
  };
}

/** Loads one page of the list and the place the address names (or the first row). Every place is reachable by search or by paging. */
export async function loadPlacesScreen(query: PlacesQuery = {}): Promise<PlacesScreenData> {
  await connectDb();
  const q = (query.q ?? "").trim().slice(0, SEARCH_MAX);
  const pageSize = Math.max(1, Math.min(Math.floor(query.pageSize ?? PLACE_PAGE_SIZE), PLACE_PAGE_MAX));
  const match: Record<string, unknown> = { type: { $in: MANAGED } };
  if (q) {
    const rx = new RegExp(escapeRegExp(q), "i");
    match.$or = [{ name: rx }, { slug: rx }];
  }
  const total = await Location.countDocuments(match);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(query.page ?? 1)), pages);
  const docs = await Location.aggregate<Lean>([
    { $match: match },
    { $addFields: { rank: { $switch: { branches: Object.entries(RANK).map(([type, rank]) => ({ case: { $eq: ["$type", type] }, then: rank })), default: 9 } } } },
    { $sort: { rank: 1, name: 1, _id: 1 } },
    { $skip: (page - 1) * pageSize },
    { $limit: pageSize },
    { $project: { type: 1, slug: 1, name: 1, parentId: 1, enabled: 1, order: 1, countryCode: 1, photo: 1, band: 1 } },
  ]).collation({ locale: "en", strength: 2 });
  const [views, parents] = await Promise.all([picturesOf(docs as never), parentNames(docs.map((doc) => doc.parentId))]);
  const rows: PlaceRowView[] = docs.map((doc, index) => ({
    id: String(doc._id),
    slug: doc.slug,
    name: doc.name,
    type: doc.type as PlaceRowView["type"],
    where: doc.parentId ? (parents.get(String(doc.parentId)) ?? "") : "",
    enabled: doc.enabled !== false,
    thumb: views[index].photo?.image.src ?? "",
  }));
  const base = { rows, total, page, pages, pageSize, q };

  // The place the address names may be on another page or outside the search, so it is read on its own.
  const wanted = query.id && Types.ObjectId.isValid(query.id) ? await Location.findOne({ _id: query.id, type: { $in: MANAGED } }).select("type slug name parentId enabled order countryCode photo band").lean() : null;
  const doc = (wanted ?? (docs[0] as unknown as Lean | undefined)) as unknown as (Lean & { photo?: unknown; band?: unknown }) | undefined;
  if (!doc) return { ...base, detail: null, chosen: false };
  const [view] = wanted ? await picturesOf([wanted as never]) : [views[0]];
  const where = doc.parentId ? ((await parentNames([doc.parentId])).get(String(doc.parentId)) ?? "") : "";
  return { ...base, chosen: Boolean(wanted), detail: await detailOf(doc as Lean, view, where) };
}
