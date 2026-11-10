import { Types } from "mongoose";
import { cached } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { safeSearch } from "@/lib/sanitize";
import { Location, type LocationDoc, type LocationLevel } from "@/server/models";
import { TOP_CITY_SLUGS } from "@/server/seed/data";

const LEVELS: LocationLevel[] = ["country", "state", "city", "district", "locality"];

export interface LocationRow {
  _id?: Types.ObjectId;
  type: LocationLevel;
  slug: string;
  name: string;
  parentId?: Types.ObjectId | null;
  enabled?: boolean;
  order?: number;
  oldSlugs?: string[];
}

export interface PublicLocation {
  id: string;
  slug: string;
  name: string;
  type: LocationLevel;
  parentId: string | null;
  kind: LocationLevel;
  status: "active" | "disabled";
  stateSlug: string;
  citySlug: string;
  parentSlug: string;
  isTop: boolean;
  sortOrder: number;
}

export async function loadLocations(): Promise<LocationRow[]> {
  return cached(
    "locations:rows",
    30_000,
    async () => {
      await connectDb();
      const rows = await Location.find().lean();
      return rows as LocationRow[];
    },
    ["locations"],
  );
}

function byId(rows: LocationRow[]) {
  return new Map(rows.map((row) => [String(row._id), row]));
}

function ancestors(doc: LocationRow, index: Map<string, LocationRow>) {
  const chain: LocationRow[] = [];
  const seen = new Set<string>();
  let current = doc;
  while (current.parentId) {
    const parent = index.get(String(current.parentId));
    if (!parent || seen.has(String(parent._id))) break;
    seen.add(String(parent._id));
    chain.push(parent);
    current = parent;
  }
  return chain;
}

export function presentLocation(doc: LocationRow, index = byId([doc])): PublicLocation {
  const parents = ancestors(doc, index);
  const state = parents.find((row) => row.type === "state") ?? (doc.type === "state" ? doc : undefined);
  const city = parents.find((row) => row.type === "city") ?? (doc.type === "city" ? doc : undefined);
  const top = TOP_CITY_SLUGS as readonly string[];
  return {
    id: String(doc._id),
    slug: doc.slug,
    name: doc.name,
    type: doc.type,
    parentId: doc.parentId ? String(doc.parentId) : null,
    kind: doc.type,
    status: doc.enabled === false ? "disabled" : "active",
    stateSlug: state?.slug ?? "",
    citySlug: doc.type === "city" ? doc.slug : (city?.slug ?? ""),
    parentSlug: parents[0]?.slug ?? "",
    isTop: doc.type === "city" && top.includes(doc.slug),
    sortOrder: doc.order ?? 999,
  };
}

function enabled(row: LocationRow) {
  return row.enabled !== false;
}

export async function listLocations(input: { type?: LocationLevel; parentId?: string; q?: string }) {
  const rows = await loadLocations();
  const index = byId(rows);
  const q = input.q ? safeSearch(input.q) : "";
  const pattern = q ? new RegExp(q, "i") : null;
  return rows
    .filter((row) => enabled(row))
    .filter((row) => (input.type ? row.type === input.type : true))
    .filter((row) => (input.parentId ? String(row.parentId ?? "") === input.parentId : true))
    .filter((row) => (pattern ? pattern.test(row.name) || pattern.test(row.slug) : true))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
    .map((row) => presentLocation(row, index));
}

export async function childLocations(id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  const rows = await loadLocations();
  const parent = rows.find((row) => String(row._id) === id);
  if (!parent) return null;
  const index = byId(rows);
  return rows
    .filter((row) => enabled(row) && String(row.parentId ?? "") === id)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
    .map((row) => presentLocation(row, index));
}

export interface ResolveResult {
  chain: PublicLocation[];
  redirected: boolean;
  canonicalSlugs: string[];
}

function sameParent(doc: LocationRow, parentId: Types.ObjectId | null) {
  const left = doc.parentId ? String(doc.parentId) : "";
  const right = parentId ? String(parentId) : "";
  return left === right;
}

export async function resolveLocations(slugs: string[]): Promise<ResolveResult | null> {
  const rows = await loadLocations();
  const index = byId(rows);
  const chain: PublicLocation[] = [];
  const canonicalSlugs: string[] = [];
  let parentId: Types.ObjectId | null = null;
  let redirected = false;
  for (let i = 0; i < slugs.length; i += 1) {
    const type = LEVELS[i];
    const slug = slugs[i];
    if (!type || !slug) return null;
    const doc = rows.find(
      (row) =>
        enabled(row) &&
        row.type === type &&
        sameParent(row, parentId) &&
        (row.slug === slug || (row.oldSlugs ?? []).includes(slug)),
    );
    if (!doc?._id) return null;
    if (doc.slug !== slug) redirected = true;
    canonicalSlugs.push(doc.slug);
    chain.push(presentLocation(doc, index));
    parentId = doc._id;
  }
  return { chain, redirected, canonicalSlugs };
}

export async function locationBySlug(slug: string) {
  const rows = await loadLocations();
  const index = byId(rows);
  const doc = rows.find(
    (row) => enabled(row) && (row.slug === slug || (row.oldSlugs ?? []).includes(slug)),
  );
  return doc ? presentLocation(doc, index) : null;
}

export async function cities(limit?: number) {
  const rows = await loadLocations();
  const index = byId(rows);
  const list = rows
    .filter((row) => enabled(row) && row.type === "city")
    .map((row) => presentLocation(row, index))
    .sort((a, b) => Number(b.isTop) - Number(a.isTop) || a.name.localeCompare(b.name));
  return limit ? list.slice(0, limit) : list;
}

export async function topCities() {
  const rows = await cities();
  const order = new Map<string, number>(TOP_CITY_SLUGS.map((slug, index) => [slug, index]));
  return rows
    .filter((row) => order.has(row.slug))
    .sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));
}

export async function siblingCities(stateSlug: string) {
  const rows = await loadLocations();
  const index = byId(rows);
  const state = rows.find((row) => enabled(row) && row.type === "state" && row.slug === stateSlug);
  if (!state?._id) return [];
  return rows
    .filter((row) => enabled(row) && row.type === "city" && String(row.parentId ?? "") === String(state._id))
    .map((row) => presentLocation(row, index))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function districts(citySlug: string) {
  const rows = await loadLocations();
  const index = byId(rows);
  const city = rows.find((row) => enabled(row) && row.type === "city" && row.slug === citySlug);
  if (!city?._id) return [];
  return rows
    .filter((row) => enabled(row) && row.type === "district" && String(row.parentId ?? "") === String(city._id))
    .map((row) => presentLocation(row, index))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function states() {
  const rows = await loadLocations();
  const index = byId(rows);
  return rows
    .filter((row) => enabled(row) && row.type === "state")
    .map((row) => presentLocation(row, index))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type { LocationDoc };
