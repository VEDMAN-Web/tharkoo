import type { Model, Schema } from "mongoose";

export class AppendOnlyError extends Error {
  readonly code = "APPEND_ONLY";

  constructor(collection = "audit_events") {
    super(`${collection} is append-only`);
    this.name = "AppendOnlyError";
  }
}

const QUERY_OPS = [
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
  "replaceOne",
] as const;

export function appendOnlyPlugin(schema: Schema, collection = "audit_events"): void {
  const reject = function rejectMutation() {
    throw new AppendOnlyError(collection);
  };
  for (const op of QUERY_OPS) {
    schema.pre(op, { document: false, query: true }, reject);
  }
  schema.pre("deleteOne", { document: true, query: false }, reject);
  schema.pre("updateOne", { document: true, query: false }, reject);
  schema.pre("save", function rejectExisting() {
    if (!this.isNew) throw new AppendOnlyError(collection);
  });
}

export function lockBulkWrites<T>(model: Model<T>, collection = "audit_events"): void {
  const writable = model as unknown as {
    bulkWrite: (
      operations: ReadonlyArray<Record<string, unknown>>,
      options?: unknown,
    ) => Promise<unknown>;
  };
  const original = writable.bulkWrite.bind(model);
  writable.bulkWrite = async (operations, options) => {
    const unsafe = operations.some((op) => !("insertOne" in op));
    if (unsafe) throw new AppendOnlyError(collection);
    return original(operations, options);
  };
}
