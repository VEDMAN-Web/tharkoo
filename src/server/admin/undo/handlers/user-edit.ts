import { can, type Perm } from "@/lib/admin/perms";
import { connectDb } from "@/lib/db";
import { refreshAdPages, revokeSessions } from "@/server/admin/user-actions";
import { PhoneIdentity } from "@/server/auth/phone";
import { ConflictError } from "@/server/http";
import { Listing, User } from "@/server/models";
import type { UndoHandler } from "../registry";

/**
 * Undo of a staff edit of a user (H7.156): profile, vendor profile, the verified badge and closing an account.
 * It uses ONLY the saved undo data, a recipe of what to put back:
 * - `set` and `unset`: user fields (dotted paths) to put back or remove, and `expect`: what they must hold now (otherwise the user changed again),
 * - `phone`: the sign-in number to put back (null removes it), `expectPhone`: what it must be now,
 * - `ads`: ads to move between "active" and "paused" (only ads still in `from`), as a close or an undo of it does.
 * Ended sign-ins are never brought back. Undoing the undo (redo) applies the inverse recipe this run saves.
 */

type Moved = { ids: string[]; from: "active" | "paused"; to: "active" | "paused" };
type Recipe = {
  userId: string;
  perm: Perm;
  set: Record<string, unknown>;
  unset: string[];
  expect: Record<string, unknown>;
  phone?: string | null;
  expectPhone?: string | null;
  ads?: Moved;
};

function read(source: unknown, path: string): unknown {
  let value: unknown = source;
  for (const part of path.split(".")) {
    if (value === null || value === undefined || typeof value !== "object") return null;
    value = (value as Record<string, unknown>)[part];
  }
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function recipeOf(event: { take<T = unknown>(key: string): T; has(key: string): boolean }): Recipe {
  return {
    userId: event.take<string>("userId"),
    perm: event.take<Perm>("perm"),
    set: event.has("set") ? event.take<Record<string, unknown>>("set") : {},
    unset: event.has("unset") ? event.take<string[]>("unset") : [],
    expect: event.has("expect") ? event.take<Record<string, unknown>>("expect") : {},
    ...(event.has("phone") ? { phone: event.take<string | null>("phone"), expectPhone: event.take<string | null>("expectPhone") } : {}),
    ...(event.has("ads") ? { ads: event.take<Moved>("ads") } : {}),
  };
}

const handler: UndoHandler = {
  canUndo(ctx, event) {
    return can(ctx.roles, event.take<Perm>("perm"));
  },

  async conflict(event) {
    await connectDb();
    const recipe = recipeOf(event);
    const user = await User.findById(recipe.userId).lean();
    if (!user) return { changedBy: null, at: new Date().toISOString(), message: "This account no longer exists." };
    const changed = Object.entries(recipe.expect).some(([path, value]) => !same(read(user, path), value));
    let phoneChanged = false;
    if (recipe.phone !== undefined) {
      const current = await PhoneIdentity.findOne({ userId: recipe.userId }).select("phone").lean<{ phone: string } | null>();
      phoneChanged = !same(current?.phone ?? null, recipe.expectPhone ?? null);
    }
    return changed || phoneChanged ? { changedBy: null, at: new Date().toISOString(), message: "This account was changed after this edit. Open the user to see its history." } : null;
  },

  async run(_ctx, event) {
    await connectDb();
    const recipe = recipeOf(event);
    const user = await User.findById(recipe.userId).lean();
    if (!user) throw new ConflictError("This account no longer exists.");
    const paths = [...Object.keys(recipe.set), ...recipe.unset];
    const inverse: Recipe = {
      userId: recipe.userId,
      perm: recipe.perm,
      set: {},
      unset: [],
      expect: Object.fromEntries(Object.entries(recipe.set).map(([path, value]) => [path, value])),
    };
    for (const path of recipe.unset) inverse.expect[path] = null;
    for (const path of paths) {
      const now = read(user, path);
      if (now === null) inverse.unset.push(path);
      else inverse.set[path] = now;
    }
    const update: Record<string, unknown> = {};
    if (Object.keys(recipe.set).length) update.$set = recipe.set;
    if (recipe.unset.length) update.$unset = Object.fromEntries(recipe.unset.map((path) => [path, ""]));
    if (Object.keys(update).length) await User.updateOne({ _id: recipe.userId }, update);

    if (recipe.phone !== undefined) {
      const current = await PhoneIdentity.findOne({ userId: recipe.userId }).select("phone").lean<{ phone: string } | null>();
      inverse.phone = current?.phone ?? null;
      inverse.expectPhone = recipe.phone;
      if (recipe.phone === null) await PhoneIdentity.deleteOne({ userId: recipe.userId });
      else {
        try {
          await PhoneIdentity.updateOne({ userId: recipe.userId }, { $set: { phone: recipe.phone } }, { upsert: true });
        } catch (error) {
          if (typeof error === "object" && error !== null && (error as { code?: number }).code === 11000) throw new ConflictError("That number now belongs to another account.");
          throw error;
        }
      }
    }

    let moved: string[] = [];
    if (recipe.ads && recipe.ads.ids.length) {
      const rows = await Listing.find({ _id: { $in: recipe.ads.ids }, ownerId: recipe.userId, status: recipe.ads.from }).select("_id").lean();
      moved = rows.map((row) => String(row._id));
      if (moved.length) await Listing.updateMany({ _id: { $in: moved } }, { $set: { status: recipe.ads.to } });
      inverse.ads = { ids: moved, from: recipe.ads.to, to: recipe.ads.from };
      await refreshAdPages(moved);
    }
    const nowClosed = (recipe.set["status"] ?? read(user, "status")) === "deleted";
    if (nowClosed) await revokeSessions(recipe.userId);

    return {
      after: { restored: paths, adsMoved: moved.length },
      summary: `${event.undoOf ? "Applied again" : "Undid the change"}: ${paths.length} ${paths.length === 1 ? "field" : "fields"}${recipe.phone !== undefined ? ", the phone number" : ""}${moved.length ? `, ${moved.length} ${moved.length === 1 ? "ad" : "ads"}` : ""}`,
      undoData: inverse,
    };
  },
};

export default handler;
