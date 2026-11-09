import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { adminUnauthorized, requireStaffRequest } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { MODEL_MAP, type ModelName } from "@/lib/models";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await requireStaffRequest(req))) return adminUnauthorized();
  const body = await req.json();
  const modelName = body.model as ModelName;
  const op = body.op as "create" | "update" | "delete";
  if (!modelName || !MODEL_MAP[modelName]) {
    return NextResponse.json({ error: "Unknown model" }, { status: 400 });
  }
  await connectDb();
  const Model = MODEL_MAP[modelName];
  let doc = null;
  if (op === "create") {
    doc = await Model.create(body.data || {});
  } else if (op === "update") {
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    doc = await Model.findByIdAndUpdate(body.id, body.data, { new: true });
  } else if (op === "delete") {
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await Model.findByIdAndDelete(body.id);
  } else {
    return NextResponse.json({ error: "Unknown op" }, { status: 400 });
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, item: doc ? JSON.parse(JSON.stringify(doc)) : null });
}
