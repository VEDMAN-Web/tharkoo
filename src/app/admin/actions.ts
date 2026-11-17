"use server";

import type { Model as MongooseModel } from "mongoose";
import { refreshPublicCache } from "@/lib/cache";
import { getStaffFromHeaders, isStaff } from "@/lib/admin-auth";
import { canUseModel } from "@/lib/admin-model-access";
import { connectDb } from "@/lib/db";
import { MODEL_MAP, type ModelName } from "@/lib/models";
import { sanitizeRecord } from "@/lib/sanitize";
import type { Perm } from "@/lib/admin/perms";
import { adminContext } from "@/server/admin/context";
import { auditAdminDenial } from "@/server/admin/denials";
import { adminWrite } from "@/server/admin/write";

/** Models whose records are lists of blocked words: the blocked-terms check must not refuse their own content. */
const TERM_LIST_MODELS = new Set(["BannedWord"]);

function permFor(model: string, op: "create" | "update" | "delete"): Perm {
  if (op === "delete") return "raw.json";
  return model === "SeoTemplate" ? "seo.edit" : "settings.edit";
}

function pick(doc: Record<string, unknown> | null, keys: string[]) {
  return Object.fromEntries(keys.filter((key) => doc && key in doc).map((key) => [key, (doc as Record<string, unknown>)[key]]));
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Every admin server action checks the role itself: a page path is not a permission. */
async function staffOrThrow() {
  const identity = await getStaffFromHeaders();
  if (!isStaff(identity)) throw new Error("Forbidden");
  return identity;
}

/** The model allowlist (src/lib/admin-model-access.ts), with a denial audit row when it refuses. */
async function modelOrThrow(identity: Awaited<ReturnType<typeof staffOrThrow>>, model: string, access: "read" | "write", op: string) {
  await connectDb();
  if (!canUseModel(identity.roles, model, access)) {
    await auditAdminDenial(identity, model, op);
    throw new Error("Forbidden");
  }
}

export async function adminList(model: string, limit = 200) {
  const identity = await staffOrThrow();
  const modelName = model as ModelName;
  if (!MODEL_MAP[modelName]) throw new Error("Unknown model");
  await modelOrThrow(identity, model, "read", "list");
  const Model = MODEL_MAP[modelName] as unknown as MongooseModel<Record<string, unknown>>;
  const items = await Model.find().limit(Math.min(limit, 200)).lean();
  return JSON.parse(JSON.stringify(items)) as Record<string, unknown>[];
}

export async function adminMutate(input: {
  model: string;
  op: "create" | "update" | "delete";
  id?: string;
  data?: Record<string, unknown>;
}) {
  const identity = await staffOrThrow();
  const modelName = input.model as ModelName;
  if (!MODEL_MAP[modelName]) throw new Error("Unknown model");
  await modelOrThrow(identity, input.model, "write", input.op);
  if (input.op !== "create" && input.op !== "update" && input.op !== "delete") throw new Error("Unknown op");
  if (input.op !== "create" && !input.id) throw new Error("id required");
  const Model = MODEL_MAP[modelName] as unknown as MongooseModel<Record<string, unknown>>;
  const data = input.data ? sanitizeRecord(input.data) : {};
  const keys = Object.keys(data);
  const ctx = await adminContext();
  const id = input.id ?? "";
  const current = async () => (id ? ((await Model.findById(id).lean()) as Record<string, unknown> | null) : null);
  const written = await adminWrite<Record<string, unknown> | null>(ctx, {
    perm: permFor(input.model, input.op),
    action: `json.${input.op}`,
    target: { type: input.model, id: id || "new" },
    texts: TERM_LIST_MODELS.has(input.model) ? undefined : data,
    undo: input.op === "update" ? { kind: "record.restore", windowKey: "settings" } : input.op === "delete" ? { lock: "purged" } : undefined,
    before: async () => (input.op === "update" ? pick(plain(await current()), keys) : input.op === "delete" ? plain(await current()) : null),
    apply: async () => {
      if (input.op === "create") {
        const doc = plain((await Model.create(data)).toObject() as Record<string, unknown>);
        return { after: pick(doc, keys), result: doc, summary: `Created a ${input.model} record` };
      }
      if (input.op === "update") {
        const was = plain(await current());
        const doc = plain((await Model.findByIdAndUpdate(id, data, { new: true })) as Record<string, unknown> | null);
        const restore = pick(was, keys);
        const unset = keys.filter((key) => !was || !(key in was));
        return {
          after: pick(doc, keys),
          result: doc,
          summary: `Changed ${keys.length} field${keys.length === 1 ? "" : "s"} of a ${input.model} record`,
          undoData: { model: input.model, id, restore, unset, expect: pick(doc, keys) },
        };
      }
      await Model.findByIdAndDelete(id);
      return { after: null, result: null, summary: `Deleted a ${input.model} record` };
    },
  });
  await refreshPublicCache();
  return { ok: true, item: written.result, eventId: written.eventId, undoUntil: written.undoUntil };
}
