import { readFile } from "node:fs/promises";
import path from "node:path";
import { Types } from "mongoose";
import { refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import { validateSlug } from "@/lib/urls";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { ForbiddenError, ValidationError } from "@/server/http";
import { Category, Location } from "@/server/models";
import { textDenied } from "@/server/shared/policy";
import { readAreaTable, readCityTable, shapeProblem, type AreaRow, type CityRow, type RowProblem } from "./import-csv";

/**
 * H16.1: "Import cities and areas (CSV)" on Admin > Cities & areas.
 * PREVIEW reads the file and sorts every row into new, already there, or a problem, and writes nothing.
 * IMPORT adds only the new rows. It never renames, hides, reorders or removes a place that is already there. One import is
 * ONE audit entry with the counts, and Undo for that entry removes the places it added (see undo/handlers/locations-import.ts).
 */

export type ImportKind = "cities" | "areas";
export type ImportSource = { kind: ImportKind; from: "builtin" | "upload"; text?: string };

export const BUILTIN_FILES: Record<ImportKind, { file: string; label: string }> = {
  cities: { file: "india-cities.csv", label: "Cities and towns of India (built-in list)" },
  areas: { file: "india-areas.csv", label: "Areas of the largest cities (built-in list)" },
};

const PROBLEMS_SHOWN = 25;
const SAMPLES_SHOWN = 8;
const INSERT_CHUNK = 250;

export type ImportPreview = {
  kind: ImportKind;
  total: number;
  fresh: number;
  existing: number;
  problems: number;
  problemRows: RowProblem[];
  samples: string[];
};

type NewPlace = { _id: Types.ObjectId; type: "city" | "district"; slug: string; name: string; parentId: Types.ObjectId; order: number; label: string };
type Analysis = { preview: ImportPreview; fresh: NewPlace[] };

function requireEditor(ctx: AdminCtx) {
  if (!can(ctx.roles, "catalogue.edit")) throw new ForbiddenError("You do not have permission to import places");
}

async function textOf(source: ImportSource): Promise<string> {
  if (source.from === "upload") {
    const text = String(source.text ?? "");
    if (!text.trim()) throw new ValidationError("Choose a CSV file first.");
    return text;
  }
  return readFile(path.join(process.cwd(), "data", "locations", BUILTIN_FILES[source.kind].file), "utf8");
}

const key = (value: string) => value.trim().toLowerCase();

function summarise(kind: ImportKind, total: number, existing: number, problemRows: RowProblem[], fresh: NewPlace[]): ImportPreview {
  return {
    kind,
    total,
    fresh: fresh.length,
    existing,
    problems: problemRows.length,
    problemRows: problemRows.slice(0, PROBLEMS_SHOWN),
    samples: fresh.slice(0, SAMPLES_SHOWN).map((item) => item.label),
  };
}

function nameProblem(name: string): string {
  return textDenied(name).denied ? "The name has a term that is not allowed on Tharkoo." : "";
}

async function analyseCities(text: string): Promise<Analysis> {
  const table = readCityTable(text);
  if (!table.ok) throw new ValidationError(table.message);
  await connectDb();
  const [states, cities, categories] = await Promise.all([
    Location.find({ type: "state" }).select("name").lean<{ _id: Types.ObjectId; name: string }[]>(),
    Location.find({ type: "city" }).select("slug name parentId oldSlugs order").lean<{ slug: string; name: string; parentId?: Types.ObjectId | null; oldSlugs?: string[]; order?: number }[]>(),
    Category.find({}).select("slug").lean<{ slug: string }[]>(),
  ]);
  const stateByName = new Map(states.map((item) => [key(item.name), item]));
  const stateNameById = new Map(states.map((item) => [String(item._id), item.name]));
  const here = new Set<string>();
  const slugOwner = new Map<string, string>();
  for (const city of cities) {
    here.add(`${String(city.parentId)}|${key(city.name)}`);
    here.add(`${String(city.parentId)}|${city.slug}`);
    slugOwner.set(city.slug, `${city.name} in ${stateNameById.get(String(city.parentId)) ?? "another state"}`);
    for (const old of city.oldSlugs ?? []) slugOwner.set(old, `${city.name} (an old address)`);
  }
  const categorySlugs = new Set(categories.map((item) => item.slug));
  // Every new city gets the same Order number, after all the cities already there, so they list by name behind them.
  const newOrder = cities.reduce((top, city) => Math.max(top, city.order ?? 0), 0) + 1;
  const seenSlug = new Map<string, number>();
  const seenName = new Map<string, number>();
  const problemRows: RowProblem[] = [];
  const fresh: NewPlace[] = [];
  let existing = 0;
  for (const row of table.rows) {
    const problem = cityProblem(row, stateByName, seenSlug, seenName, categorySlugs);
    const parent = stateByName.get(key(row.state));
    if (problem || !parent) {
      problemRows.push({ line: row.line, name: row.name || "(no name)", message: problem || "The state is not on Tharkoo." });
      continue;
    }
    if (here.has(`${String(parent._id)}|${key(row.name)}`) || here.has(`${String(parent._id)}|${row.slug}`)) {
      existing += 1;
      continue;
    }
    const owner = slugOwner.get(row.slug);
    if (owner) {
      problemRows.push({ line: row.line, name: row.name, message: `The web address "${row.slug}" is already used by ${owner}.` });
      continue;
    }
    slugOwner.set(row.slug, `${row.name} in ${row.state} (in this file)`);
    fresh.push({ _id: new Types.ObjectId(), type: "city", slug: row.slug, name: row.name, parentId: parent._id, order: newOrder, label: `${row.name}, ${row.state}` });
  }
  return { preview: summarise("cities", table.rows.length, existing, problemRows, fresh), fresh };
}

function cityProblem(row: CityRow, states: Map<string, unknown>, seenSlug: Map<string, number>, seenName: Map<string, number>, categories: Set<string>): string {
  const shape = shapeProblem(row, (slug) => validateSlug(slug));
  if (shape) return shape;
  if (!states.has(key(row.state))) return `The state "${row.state}" is not on Tharkoo.`;
  const denied = nameProblem(row.name);
  if (denied) return denied;
  if (categories.has(row.slug)) return `The web address "${row.slug}" is a category address.`;
  const nameKey = `${key(row.state)}|${key(row.name)}`;
  const earlier = seenSlug.get(row.slug) ?? seenName.get(nameKey);
  seenSlug.set(row.slug, seenSlug.get(row.slug) ?? row.line);
  seenName.set(nameKey, seenName.get(nameKey) ?? row.line);
  return earlier ? `This place is repeated in the file (first on line ${earlier}).` : "";
}

async function analyseAreas(text: string): Promise<Analysis> {
  const table = readAreaTable(text);
  if (!table.ok) throw new ValidationError(table.message);
  await connectDb();
  const cities = await Location.find({ type: "city" }).select("slug name").lean<{ _id: Types.ObjectId; slug: string; name: string }[]>();
  const bySlug = new Map(cities.map((item) => [item.slug, item]));
  const byName = new Map<string, typeof cities>();
  for (const city of cities) byName.set(key(city.name), [...(byName.get(key(city.name)) ?? []), city]);
  const districts = await Location.find({ type: "district", parentId: { $in: cities.map((item) => item._id) } }).select("slug name parentId order").lean<{ slug: string; name: string; parentId: Types.ObjectId; order?: number }[]>();
  const here = new Set<string>();
  const nextOrder = new Map<string, number>();
  for (const item of districts) {
    here.add(`${String(item.parentId)}|${item.slug}`);
    here.add(`${String(item.parentId)}|${key(item.name)}`);
    nextOrder.set(String(item.parentId), Math.max(nextOrder.get(String(item.parentId)) ?? 0, (item.order ?? 0) + 1));
  }
  const seen = new Map<string, number>();
  const problemRows: RowProblem[] = [];
  const fresh: NewPlace[] = [];
  let existing = 0;
  for (const row of table.rows) {
    const found = bySlug.get(row.city) ?? (byName.get(key(row.city))?.length === 1 ? byName.get(key(row.city))![0] : undefined);
    const problem = areaProblem(row, found, byName.get(key(row.city))?.length ?? 0, seen);
    if (problem || !found) {
      problemRows.push({ line: row.line, name: row.name || "(no name)", message: problem || "The city is not on Tharkoo." });
      continue;
    }
    const parentKey = String(found._id);
    if (here.has(`${parentKey}|${row.slug}`) || here.has(`${parentKey}|${key(row.name)}`)) {
      existing += 1;
      continue;
    }
    here.add(`${parentKey}|${row.slug}`);
    here.add(`${parentKey}|${key(row.name)}`);
    const order = nextOrder.get(parentKey) ?? 0;
    nextOrder.set(parentKey, order + 1);
    fresh.push({ _id: new Types.ObjectId(), type: "district", slug: row.slug, name: row.name, parentId: found._id, order, label: `${row.name}, ${found.name}` });
  }
  return { preview: summarise("areas", table.rows.length, existing, problemRows, fresh), fresh };
}

function areaProblem(row: AreaRow, found: unknown, sameName: number, seen: Map<string, number>): string {
  const shape = shapeProblem(row, (slug) => validateSlug(slug));
  if (shape) return shape;
  if (!row.city) return "The city is empty.";
  if (!found) return sameName > 1 ? `More than one city is called "${row.city}". Use its web address in the city column.` : `The city "${row.city}" is not on Tharkoo.`;
  const denied = nameProblem(row.name);
  if (denied) return denied;
  const id = `${key(row.city)}|${row.slug}`;
  const earlier = seen.get(id);
  seen.set(id, earlier ?? row.line);
  return earlier ? `This area is repeated in the file (first on line ${earlier}).` : "";
}

async function analyse(source: ImportSource): Promise<Analysis> {
  if (source.kind !== "cities" && source.kind !== "areas") throw new ValidationError("Choose what to import.");
  const text = await textOf(source);
  return source.kind === "cities" ? analyseCities(text) : analyseAreas(text);
}

export async function previewImport(ctx: AdminCtx, source: ImportSource): Promise<ImportPreview> {
  await connectDb();
  requireEditor(ctx);
  return (await analyse(source)).preview;
}

export type ImportResult = { added: number; existing: number; skipped: number; eventId: string; undoUntil: string | null };

/** Adds the new rows of the file, one audit entry for the whole import. Anything already there is left exactly as it is. */
export async function runImport(ctx: AdminCtx, source: ImportSource): Promise<ImportResult> {
  await connectDb();
  requireEditor(ctx);
  const { preview, fresh } = await analyse(source);
  if (fresh.length === 0) throw new ValidationError("There is nothing new to add. Every row is already there or has a problem.");
  const noun = preview.kind === "cities" ? "cities" : "areas";
  const written = await adminWrite<{ added: number }>(ctx, {
    perm: "catalogue.edit",
    action: "location.import",
    target: { type: "Location", id: String(fresh[0]._id), label: `${fresh.length.toLocaleString("en-IN")} ${noun}` },
    texts: fresh.map((item) => item.name),
    undo: { kind: "locations.import", windowKey: "edits" },
    before: async () => ({ kind: preview.kind, rowsInFile: preview.total }),
    apply: async () => {
      await insertAll(fresh);
      await refreshPublicCache();
      return {
        after: { kind: preview.kind, added: fresh.length, alreadyThere: preview.existing, skipped: preview.problems },
        result: { added: fresh.length },
        summary: `Imported ${fresh.length.toLocaleString("en-IN")} ${noun} (${preview.existing.toLocaleString("en-IN")} already there, ${preview.problems.toLocaleString("en-IN")} skipped)`,
        undoData: { kind: preview.kind, ids: fresh.map((item) => String(item._id)) },
      };
    },
  });
  return { added: written.result.added, existing: preview.existing, skipped: preview.problems, eventId: written.eventId, undoUntil: written.undoUntil };
}

async function insertAll(fresh: NewPlace[]) {
  const docs = fresh.map((item) => ({ _id: item._id, type: item.type, slug: item.slug, name: item.name, parentId: item.parentId, enabled: true, order: item.order, countryCode: "IN" }));
  try {
    for (let from = 0; from < docs.length; from += INSERT_CHUNK) await Location.insertMany(docs.slice(from, from + INSERT_CHUNK), { ordered: true });
  } catch (error) {
    // Put back what this import had added so far, so a failed import leaves nothing half done.
    await Location.deleteMany({ _id: { $in: docs.map((item) => item._id) } });
    throw error;
  }
}
