"use server";

import { revalidatePath } from "next/cache";
import { getStaffFromHeaders, isStaff } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { MODEL_MAP, type ModelName } from "@/lib/models";

async function staffOrThrow() {
  const identity = await getStaffFromHeaders();
  if (!isStaff(identity)) throw new Error("Sign in required");
}

export async function adminList(model: string, limit = 200) {
  await staffOrThrow();
  const modelName = model as ModelName;
  if (!MODEL_MAP[modelName]) throw new Error("Unknown model");
  await connectDb();
  const items = await MODEL_MAP[modelName].find().limit(Math.min(limit, 200)).lean();
  return JSON.parse(JSON.stringify(items)) as Record<string, unknown>[];
}

export async function adminMutate(input: {
  model: string;
  op: "create" | "update" | "delete";
  id?: string;
  data?: Record<string, unknown>;
}) {
  await staffOrThrow();
  const modelName = input.model as ModelName;
  if (!MODEL_MAP[modelName]) throw new Error("Unknown model");
  await connectDb();
  const Model = MODEL_MAP[modelName];
  let doc = null;
  if (input.op === "create") {
    doc = await Model.create(input.data || {});
  } else if (input.op === "update") {
    if (!input.id) throw new Error("id required");
    doc = await Model.findByIdAndUpdate(input.id, input.data, { new: true });
  } else if (input.op === "delete") {
    if (!input.id) throw new Error("id required");
    await Model.findByIdAndDelete(input.id);
  } else {
    throw new Error("Unknown op");
  }
  revalidatePath("/", "layout");
  return { ok: true, item: doc ? JSON.parse(JSON.stringify(doc)) : null };
}
