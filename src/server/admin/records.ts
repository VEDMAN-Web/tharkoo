import type { Model as MongooseModel } from "mongoose";
import { Types } from "mongoose";
import { refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { can, type Perm } from "@/lib/admin/perms";
import { KINDS, PAGE_SIZES, type KindConfig, type RecordKind } from "@/lib/admin/record-kinds";
import { sanitizeRecord } from "@/lib/sanitize";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { Banner, BannedWord, FeatureFlag, HelpArticle } from "@/server/models";

type Doc = Record<string, unknown>;
const MODELS = { BannedWord, Banner, FeatureFlag, HelpArticle } as unknown as Record<KindConfig["model"], MongooseModel<Doc>>;
const SEARCH_MAX = 120;
const RAW_HIDDEN = new Set(["_id", "__v", "createdAt", "updatedAt"]);

export type RecordsQuery = { q: string; page: number; pageSize: number };
export type RecordRow = { id: string; values: Doc };
export type RecordList = { rows: RecordRow[]; total: number; query: RecordsQuery };
export type RecordDetail = { id: string; values: Doc; raw: string | null };

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pick(doc: Doc | null, keys: string[]): Doc {
  return Object.fromEntries(keys.filter((key) => doc && key in doc).map((key) => [key, (doc as Doc)[key]]));
}

function valuesOf(config: KindConfig, doc: Doc): Doc {
  return Object.fromEntries(
    config.fields.map((field) => {
      const value = doc[field.name];
      if (field.type === "switch") return [field.name, value === undefined ? false : Boolean(value)];
      if (field.type === "number") return [field.name, typeof value === "number" ? value : ""];
      return [field.name, typeof value === "string" ? value : value === undefined || value === null ? "" : String(value)];
    }),
  );
}

export function parseRecordsQuery(params: Record<string, string | string[] | undefined>): RecordsQuery {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const size = Number(one("size"));
  const page = Math.floor(Number(one("page")));
  return {
    q: one("q").trim().slice(0, SEARCH_MAX),
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(size) ? size : 25,
  };
}

function requireView(roles: readonly string[], config: KindConfig) {
  if (!can(roles, config.view)) throw new ForbiddenError("You cannot open this screen");
}

export async function listRecords(roles: readonly string[], kind: RecordKind, query: RecordsQuery): Promise<RecordList> {
  const config = KINDS[kind];
  requireView(roles, config);
  await connectDb();
  const Model = MODELS[config.model];
  const filter = query.q ? { $or: config.searchFields.map((field) => ({ [field]: { $regex: escapeRegex(query.q), $options: "i" } })) } : {};
  const [total, docs] = await Promise.all([
    Model.countDocuments(filter),
    Model.find(filter)
      .sort(config.sort)
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean<Doc[]>(),
  ]);
  return { query, total, rows: docs.map((doc) => ({ id: String(doc._id), values: valuesOf(config, plain(doc)) })) };
}

export async function getRecord(roles: readonly string[], kind: RecordKind, id: string): Promise<RecordDetail> {
  const config = KINDS[kind];
  requireView(roles, config);
  await connectDb();
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Record not found");
  const doc = await MODELS[config.model].findById(id).lean<Doc | null>();
  if (!doc) throw new NotFoundError("Record not found");
  const clean = plain(doc);
  const raw = can(roles, "raw.json") ? JSON.stringify(Object.fromEntries(Object.entries(clean).filter(([key]) => !RAW_HIDDEN.has(key))), null, 2) : null;
  return { id, values: valuesOf(config, clean), raw };
}

function validated(config: KindConfig, input: unknown): Doc {
  const parsed = config.schema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0] ?? "form")] = [issue.message];
    throw new ValidationError("Check the highlighted fields", fields);
  }
  const clean = parsed.data as Doc;
  for (const key of Object.keys(clean)) if (clean[key] === undefined) delete clean[key];
  return clean;
}

/** A role without the right gets one denial row in the audit log, then an error, before anything is read or checked. */
async function requirePerm(ctx: AdminCtx, perm: Perm, action: string, target: { type: string; id: string }) {
  if (can(ctx.roles, perm)) return;
  await adminWrite(ctx, {
    perm,
    action,
    target,
    before: async () => null,
    apply: async () => ({ after: null, result: null, summary: "" }),
  });
}

function nameOf(config: KindConfig, doc: Doc | null) {
  const name = doc ? doc[config.nameField] : "";
  return typeof name === "string" && name ? name : config.singular;
}

async function afterWrite() {
  await refreshPublicCache();
}

export type SaveResult = { id: string; created: boolean; name: string; eventId: string; undoUntil: string | null };

/** Create (no id) or change one record. A change can be undone (the old values come back); a new record has nothing to restore. */
export async function saveRecord(ctx: AdminCtx, kind: RecordKind, input: { id?: string; values: unknown }): Promise<SaveResult> {
  const config = KINDS[kind];
  await connectDb();
  const Model = MODELS[config.model];
  const id = input.id ?? "";
  await requirePerm(ctx, config.write, `${config.model.toLowerCase()}.save`, { type: config.model, id: id || "new" });
  if (id && !Types.ObjectId.isValid(id)) throw new NotFoundError("Record not found");
  const submitted = validated(config, input.values);
  const data = sanitizeRecord(submitted);
  if (id) for (const field of config.fields) if (field.createOnly) delete data[field.name];
  const keys = Object.keys(data);
  const current = async () => (id ? plain(await Model.findById(id).lean<Doc | null>()) : null);
  const existing = id ? await current() : null;
  if (id && !existing) throw new NotFoundError("Record not found");
  const written = await adminWrite<{ id: string; name: string }>(ctx, {
    perm: config.write,
    action: id ? `${config.model.toLowerCase()}.update` : `${config.model.toLowerCase()}.create`,
    target: { type: config.model, id: id || "new", label: nameOf(config, existing ?? data) },
    texts: config.termList ? undefined : data,
    undo: id ? { kind: "record.restore", windowKey: "settings" } : undefined,
    before: async () => (id ? pick(existing, keys) : null),
    apply: async () => {
      if (!id) {
        try {
          const doc = plain((await Model.create(data)).toObject() as Doc);
          return { after: pick(doc, keys), result: { id: String(doc._id), name: nameOf(config, doc) }, summary: `Created a ${config.singular}: ${nameOf(config, doc)}` };
        } catch (error) {
          if (error instanceof Error && /E11000/.test(error.message)) throw new ConflictError("A record with this key or web address already exists");
          throw error;
        }
      }
      const was = (await current()) as Doc;
      let doc: Doc | null;
      try {
        doc = plain(await Model.findByIdAndUpdate(id, data, { returnDocument: "after" }).lean<Doc | null>());
      } catch (error) {
        if (error instanceof Error && /E11000/.test(error.message)) throw new ConflictError("A record with this key or web address already exists");
        throw error;
      }
      return {
        after: pick(doc, keys),
        result: { id, name: nameOf(config, doc) },
        summary: `Changed the ${config.singular}: ${nameOf(config, doc)}`,
        undoData: { model: config.model, id, restore: pick(was, keys), unset: keys.filter((key) => !(key in was)), expect: pick(doc, keys) },
      };
    },
  });
  await afterWrite();
  return { ...written.result, created: !id, eventId: written.eventId, undoUntil: written.undoUntil };
}

export async function deleteRecord(ctx: AdminCtx, kind: RecordKind, id: string): Promise<{ name: string }> {
  const config = KINDS[kind];
  await connectDb();
  await requirePerm(ctx, config.remove, `${config.model.toLowerCase()}.delete`, { type: config.model, id });
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Record not found");
  const Model = MODELS[config.model];
  const existing = plain(await Model.findById(id).lean<Doc | null>());
  if (!existing) throw new NotFoundError("Record not found");
  const name = nameOf(config, existing);
  await adminWrite(ctx, {
    perm: config.remove,
    action: `${config.model.toLowerCase()}.delete`,
    target: { type: config.model, id, label: name },
    undo: { lock: "purged" },
    before: async () => existing,
    apply: async () => {
      await Model.findByIdAndDelete(id);
      return { after: null, result: null, summary: `Deleted the ${config.singular}: ${name}` };
    },
  });
  await afterWrite();
  return { name };
}

/** The raw data of one record as JSON, for a superadmin only. A change goes through the same write helper and can be undone. */
export async function saveRawRecord(ctx: AdminCtx, kind: RecordKind, id: string, text: string): Promise<SaveResult> {
  const config = KINDS[kind];
  await connectDb();
  await requirePerm(ctx, "raw.json", `${config.model.toLowerCase()}.raw`, { type: config.model, id });
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Record not found");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ValidationError("This is not valid JSON", { raw: ["Fix the JSON and try again."] });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new ValidationError("The raw data must be one JSON object", { raw: ["Use one object in curly brackets."] });
  const data = sanitizeRecord(Object.fromEntries(Object.entries(parsed as Doc).filter(([key]) => !RAW_HIDDEN.has(key))));
  const Model = MODELS[config.model];
  const keys = Object.keys(data);
  const existing = plain(await Model.findById(id).lean<Doc | null>());
  if (!existing) throw new NotFoundError("Record not found");
  const written = await adminWrite<{ id: string; name: string }>(ctx, {
    perm: "raw.json",
    action: `${config.model.toLowerCase()}.raw`,
    target: { type: config.model, id, label: nameOf(config, existing) },
    texts: config.termList ? undefined : data,
    undo: { kind: "record.restore", windowKey: "settings" },
    before: async () => pick(existing, keys),
    apply: async () => {
      const doc = plain(await Model.findByIdAndUpdate(id, data, { returnDocument: "after" }).lean<Doc | null>());
      return {
        after: pick(doc, keys),
        result: { id, name: nameOf(config, doc) },
        summary: `Changed raw data of the ${config.singular}: ${nameOf(config, doc)}`,
        undoData: { model: config.model, id, restore: pick(existing, keys), unset: keys.filter((key) => !(key in existing)), expect: pick(doc, keys) },
      };
    },
  });
  await afterWrite();
  return { ...written.result, created: false, eventId: written.eventId, undoUntil: written.undoUntil };
}

