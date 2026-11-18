import { Types } from "mongoose";
import { refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { BULK_MAX, BULK_TYPED_FROM } from "@/lib/admin/ads-bulk-rules";
import type { AdsQuery } from "@/server/admin/ads-list";
import { filterFor } from "@/server/admin/ads-list";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { ValidationError } from "@/server/http";
import { isPeopleListing } from "@/server/categories/kinds";
import { Category, Listing } from "@/server/models";

/**
 * H10.2: move ads to another category, in one audited write with one Undo. Either the ads that were selected (up to 100),
 * or every ad that matches the current tab, search and filters (up to MOVE_MAX). Nothing moves until a person presses the button here.
 * An ad's sub-category belongs to its old category, so it is cleared; Undo puts both back.
 */

export const MOVE_MAX = 5000;

export type MoveInput = {
  categoryId: string;
  /** "selected": the ads in `ids`. "filter": every ad that matches `query`. */
  scope: "selected" | "filter";
  ids?: string[];
  query?: AdsQuery;
  /** The number of ads, typed, when 50 or more move at once. */
  confirm?: string;
};

export type MoveResult = { moved: number; alreadyThere: number; categoryName: string; eventId: string };

type Lean = { _id: Types.ObjectId; categoryId: Types.ObjectId; subcategoryId?: Types.ObjectId | null; attributes?: Record<string, unknown> | null };

export const PEOPLE_OUT_MESSAGE = "These ads are about people, so they can only move to another people category.";

type CategoryRow = { _id: Types.ObjectId; slug?: string; kind?: string; fields?: unknown };

/** The age on an ad, as the post flow reads it: a number, or a string of digits, in attributes.age. */
function hasAdultAge(attributes: Record<string, unknown> | null | undefined): boolean {
  const raw = attributes?.age;
  const age = typeof raw === "number" ? raw : typeof raw === "string" && /^\d{1,3}$/.test(raw) ? Number(raw) : NaN;
  return Number.isFinite(age) && age >= 18;
}

/**
 * The people rules, so a move cannot get around the adults-only and no-video rules. Uses the same people check as the video guard
 * (isPeopleListing), never a slug list of its own.
 * Out of a people category into a non-people one: refused. Into a people category from a non-people one: only when every ad has an age of 18 or more.
 */
async function enforcePeopleRules(toMove: Lean[], destination: CategoryRow & { name: string }): Promise<void> {
  const sourceIds = Array.from(new Set(toMove.map((row) => String(row.categoryId))));
  const sources = await Category.find({ _id: { $in: sourceIds } }).select("slug kind fields").lean<CategoryRow[]>();
  const peopleSources = new Set(sources.filter((row) => isPeopleListing(row)).map((row) => String(row._id)));
  const destinationIsPeople = isPeopleListing(destination);
  if (!destinationIsPeople) {
    if (toMove.some((row) => peopleSources.has(String(row.categoryId)))) throw new ValidationError(PEOPLE_OUT_MESSAGE);
    return;
  }
  const entering = toMove.filter((row) => !peopleSources.has(String(row.categoryId)));
  const lacking = entering.filter((row) => !hasAdultAge(row.attributes)).length;
  if (lacking > 0) {
    throw new ValidationError(`${lacking} of the ${entering.length} ads coming from a non-people category have no age of 18 or more, so they cannot move into ${destination.name}. Add the age to those ads first.`);
  }
}

export async function moveAdsToCategory(ctx: AdminCtx, input: MoveInput): Promise<MoveResult> {
  await connectDb();
  if (!Types.ObjectId.isValid(input.categoryId)) throw new ValidationError("Choose the category to move the ads to.");
  const category = await Category.findOne({ _id: input.categoryId, deletedAt: null }).select("name slug kind fields").lean<(CategoryRow & { name: string }) | null>();
  if (!category) throw new ValidationError("That category is not there any more. Choose another.");

  let matches: Lean[];
  if (input.scope === "filter") {
    if (!input.query) throw new ValidationError("Nothing to move.");
    const filter = await filterFor(input.query);
    const total = await Listing.countDocuments(filter);
    if (total > MOVE_MAX) throw new ValidationError(`${total.toLocaleString("en-IN")} ads match. Narrow the filters to ${MOVE_MAX.toLocaleString("en-IN")} or fewer, then try again.`);
    matches = await Listing.find(filter).select("categoryId subcategoryId attributes").lean<Lean[]>();
  } else {
    const ids = Array.from(new Set((input.ids ?? []).map(String)));
    if (ids.length < 1) throw new ValidationError("Select at least one ad.");
    if (ids.length > BULK_MAX) throw new ValidationError(`Select at most ${BULK_MAX} ads at a time, or move every ad that matches the filters.`);
    if (ids.some((id) => !Types.ObjectId.isValid(id))) throw new ValidationError("Invalid request");
    matches = await Listing.find({ _id: { $in: ids } }).select("categoryId subcategoryId attributes").lean<Lean[]>();
  }
  const toMove = matches.filter((row) => String(row.categoryId) !== String(category._id));
  const alreadyThere = matches.length - toMove.length;
  if (toMove.length === 0) throw new ValidationError(matches.length ? `Those ads are already in ${category.name}.` : "No ads to move.");
  await enforcePeopleRules(toMove, category);
  if (toMove.length >= BULK_TYPED_FROM && (input.confirm ?? "").trim() !== String(toMove.length)) {
    throw new ValidationError(`Type ${toMove.length} to confirm moving ${toMove.length} ads to ${category.name}.`);
  }

  const label = `${toMove.length} ${toMove.length === 1 ? "ad" : "ads"} to ${category.name}`;
  const written = await adminWrite<{ moved: number }>(ctx, {
    perm: "ads.edit",
    action: "listing.move_category",
    target: { type: "listing", id: String(toMove[0]._id), label },
    undo: { kind: "ads.move", windowKey: "edits" },
    before: async () => ({ ads: toMove.length, firstFrom: String(toMove[0].categoryId) }),
    apply: async () => {
      const ids = toMove.map((row) => row._id);
      await Listing.updateMany({ _id: { $in: ids } }, { $set: { categoryId: category._id }, $unset: { subcategoryId: "" } });
      await refreshPublicCache();
      return {
        after: { ads: toMove.length, categoryId: String(category._id), categoryName: category.name },
        result: { moved: toMove.length },
        summary: `Moved ${label}`,
        undoData: { to: String(category._id), items: toMove.map((row) => [String(row._id), String(row.categoryId), row.subcategoryId ? String(row.subcategoryId) : ""]) },
      };
    },
  });
  return { moved: written.result.moved, alreadyThere, categoryName: category.name, eventId: written.eventId };
}
