import type { Types } from "mongoose";
import { refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { ConflictError, ForbiddenError, ValidationError } from "@/server/http";
import { Category, Listing, Location } from "@/server/models";
import { demoFilter } from "./demo-ads";
import { DEMO_TEXT_CATEGORIES, demoAdText } from "./demo-text";

/**
 * H17.10: "Refresh sample ad text" on the Demo ads tab. It rewrites the title and text of the sample (demo) ads that sit in a category with
 * text of its own (demo-text.ts) from those templates, naming a real area of the ad's city when there is one. It never touches a real ad, a
 * price, a photo, an address or the status. One audit entry, and Undo puts every old title and text back.
 */

const CHUNK = 400;
const DEMO_NUMBER = /demo-(\d+)/;

export const refreshTextConfirmation = (count: number) => `REFRESH ${count}`;

type Row = { _id: Types.ObjectId; slug?: string; title: string; description: string; categoryId?: Types.ObjectId; cityId?: Types.ObjectId; districtId?: Types.ObjectId };
type Change = { id: string; title: string; description: string; before: { title: string; description: string } };

async function demoRowsInCoveredCategories(): Promise<{ rows: Row[]; slugOf: Map<string, string> }> {
  const filter = await demoFilter();
  if (!filter) return { rows: [], slugOf: new Map() };
  const categories = await Category.find({ slug: { $in: DEMO_TEXT_CATEGORIES } }).select("slug").lean<{ _id: Types.ObjectId; slug: string }[]>();
  if (categories.length === 0) return { rows: [], slugOf: new Map() };
  const slugOf = new Map(categories.map((row) => [String(row._id), row.slug]));
  const rows = await Listing.find({ ...filter, categoryId: { $in: categories.map((row) => row._id) } })
    .select("slug title description categoryId cityId districtId")
    .lean<Row[]>();
  return { rows, slugOf };
}

/** How many sample ads sit in a category that has new text. The typed confirmation and the panel use this number. */
export async function demoTextCandidates(): Promise<number> {
  await connectDb();
  return (await demoRowsInCoveredCategories()).rows.length;
}

async function plan(): Promise<{ changes: Change[]; covered: number }> {
  const { rows, slugOf } = await demoRowsInCoveredCategories();
  const cityIds = [...new Set(rows.map((row) => (row.cityId ? String(row.cityId) : "")).filter(Boolean))];
  const places = await Location.find({ $or: [{ _id: { $in: cityIds } }, { parentId: { $in: cityIds }, type: "district" }] })
    .select("name type parentId enabled")
    .lean<{ _id: Types.ObjectId; name: string; type: string; parentId?: Types.ObjectId | null; enabled?: boolean }[]>();
  const cityName = new Map(places.filter((place) => place.type === "city").map((place) => [String(place._id), place.name]));
  const districtName = new Map(places.filter((place) => place.type === "district").map((place) => [String(place._id), place.name]));
  const districtsOf = new Map<string, string[]>();
  for (const place of places.filter((item) => item.type === "district" && item.enabled !== false && item.parentId)) {
    const key = String(place.parentId);
    districtsOf.set(key, [...(districtsOf.get(key) ?? []), place.name].sort((a, b) => a.localeCompare(b)));
  }
  const changes: Change[] = [];
  for (const row of rows) {
    const category = row.categoryId ? slugOf.get(String(row.categoryId)) : undefined;
    const city = row.cityId ? cityName.get(String(row.cityId)) : undefined;
    const number = Number(DEMO_NUMBER.exec(row.slug ?? "")?.[1] ?? 0);
    if (!category || !city) continue;
    // The ad's own area when it has one, else one of the city's areas picked by the ad number, else none.
    const own = row.districtId ? districtName.get(String(row.districtId)) : undefined;
    const known = districtsOf.get(String(row.cityId)) ?? [];
    const area = own ?? (known.length ? known[number % known.length] : null);
    const text = demoAdText(category, city, area, number);
    if (!text || (text.title === row.title && text.description === row.description)) continue;
    changes.push({ id: String(row._id), title: text.title, description: text.description, before: { title: row.title, description: row.description } });
  }
  return { changes, covered: rows.length };
}

export async function refreshDemoText(ctx: AdminCtx, input: { confirm: unknown }): Promise<{ rewritten: number; eventId: string; undoUntil: string | null }> {
  await connectDb();
  if (!can(ctx.roles, "ads.demo.end")) throw new ForbiddenError("Only an admin can refresh sample ad text");
  const { changes, covered } = await plan();
  if (covered === 0) throw new ConflictError("There are no sample ads in a category with new text.");
  if (changes.length === 0) throw new ConflictError("The sample ad text is already up to date.");
  const typed = typeof input.confirm === "string" ? input.confirm.trim() : "";
  if (typed !== refreshTextConfirmation(covered)) {
    throw new ValidationError("Invalid request", { confirm: [`Type ${refreshTextConfirmation(covered)} to confirm.`] });
  }
  const written = await adminWrite<{ rewritten: number }>(ctx, {
    perm: "ads.demo.end",
    action: "listing.demo.text",
    target: { type: "listing", id: "demo-ads", label: `${changes.length} sample ads` },
    texts: changes.flatMap((change) => [change.title, change.description]),
    undo: { kind: "demo.text", windowKey: "demo" },
    before: async () => ({ covered, willChange: changes.length }),
    apply: async () => {
      const filter = await demoFilter();
      let modified = 0;
      for (let from = 0; from < changes.length; from += CHUNK) {
        const part = changes.slice(from, from + CHUNK);
        const result = await Listing.bulkWrite(
          part.map((change) => ({ updateOne: { filter: { _id: change.id, ...filter }, update: { $set: { title: change.title, description: change.description } } } })),
        );
        modified += result.modifiedCount;
      }
      await refreshPublicCache();
      return {
        after: { rewritten: modified, covered },
        result: { rewritten: modified },
        summary: `Rewrote the text of ${modified} sample ${modified === 1 ? "ad" : "ads"}`,
        undoData: { items: changes.map((change) => [change.id, change.before.title, change.before.description, change.title]) },
      };
    },
  });
  return { rewritten: written.result.rewritten, eventId: written.eventId, undoUntil: written.undoUntil };
}
