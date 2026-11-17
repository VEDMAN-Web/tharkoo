import type { Model as MongooseModel } from "mongoose";
import { connectDb } from "@/lib/db";
import { canUseModel } from "@/lib/admin-model-access";
import { MODEL_MAP, type ModelName } from "@/lib/models";
import { PromotionProduct, UiText } from "@/server/models";
import type { UndoHandler } from "../registry";

type Doc = Record<string, unknown>;

/** Models the generic admin editor does not offer, but whose own screens save an undo that restores through here (H8.17). */
const UNDO_ONLY_MODELS: Record<string, unknown> = { PromotionProduct, UiText };

function modelOf(name: string) {
  if (UNDO_ONLY_MODELS[name]) return UNDO_ONLY_MODELS[name] as MongooseModel<Doc>;
  if (!MODEL_MAP[name as ModelName]) throw new Error("Unknown model");
  return MODEL_MAP[name as ModelName] as unknown as MongooseModel<Doc>;
}

function valuesOf(doc: Doc | null, keys: string[]) {
  return JSON.parse(JSON.stringify(Object.fromEntries(keys.filter((key) => doc && key in doc).map((key) => [key, (doc as Doc)[key]])))) as Doc;
}

const handler: UndoHandler = {
  canUndo: (ctx, event) => canUseModel(ctx.roles, event.take<string>("model"), "write"),
  conflict: async (event) => {
    await connectDb();
    const doc = await modelOf(event.take<string>("model")).findById(event.take<string>("id")).lean();
    const expect = event.take<Doc>("expect");
    const at = new Date().toISOString();
    if (!doc) return { changedBy: null, at };
    const now = valuesOf(doc as Doc, Object.keys(expect));
    return JSON.stringify(now) === JSON.stringify(expect) ? null : { changedBy: null, at };
  },
  run: async (_ctx, event) => {
    await connectDb();
    const Model = modelOf(event.take<string>("model"));
    const id = event.take<string>("id");
    // An empty "restore" or "unset" is not saved by the audit log, so a missing one means nothing to restore or nothing to remove.
    const restore = event.has("restore") ? event.take<Record<string, unknown>>("restore") : {};
    const unset = event.has("unset") ? event.take<string[]>("unset") : [];
    const keys = [...Object.keys(restore), ...unset];
    const was = (await Model.findById(id).lean()) as Doc | null;
    const update: Record<string, unknown> = {};
    if (Object.keys(restore).length) update.$set = restore;
    if (unset.length) update.$unset = Object.fromEntries(unset.map((key) => [key, ""]));
    const doc = (await Model.findByIdAndUpdate(id, update, { new: true }).lean()) as Doc | null;
    const back = valuesOf(was, keys);
    return {
      after: valuesOf(doc, keys),
      summary: `Restored ${keys.length} field${keys.length === 1 ? "" : "s"}`,
      undoData: {
        model: event.take<string>("model"),
        id,
        restore: back,
        unset: keys.filter((key) => !was || !(key in was)),
        expect: valuesOf(doc, keys),
      },
    };
  },
};

export default handler;
