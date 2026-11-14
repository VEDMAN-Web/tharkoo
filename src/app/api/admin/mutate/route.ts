import { NextRequest, NextResponse } from "next/server";
import { refreshPublicCache } from "@/lib/cache";
import type { Model as MongooseModel } from "mongoose";
import { adminUnauthorized, requireStaffRequest } from "@/lib/admin-auth";
import { canUseModel } from "@/lib/admin-model-access";
import { connectDb } from "@/lib/db";
import { MODEL_MAP, type ModelName } from "@/lib/models";
import { sanitizeRecord } from "@/lib/sanitize";
import { DASH_MESSAGE, dashFields } from "@/server/content/dashes";

/** SEO text: a dash here is refused with a clear message (relay #42). */
const SEO_DASH_MODELS = new Set(["SeoTemplate", "UrlOverride", "Category", "Location", "Site"]);
import { auditAdminDenial } from "@/server/admin/denials";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const identity = await requireStaffRequest(req);
  if (!identity) return adminUnauthorized();
  const body = await req.json();
  const modelName = body.model as ModelName;
  const op = body.op as "create" | "update" | "delete";
  if (!modelName || !MODEL_MAP[modelName]) {
    return NextResponse.json({ error: "Unknown model" }, { status: 400 });
  }
  await connectDb();
  if (!canUseModel(identity.roles, modelName, "write")) {
    await auditAdminDenial(identity, modelName, String(op));
    return adminUnauthorized();
  }
  const Model = MODEL_MAP[modelName] as unknown as MongooseModel<Record<string, unknown>>;
  const data = body.data ? sanitizeRecord(body.data) : {};
  if (SEO_DASH_MODELS.has(String(modelName))) {
    const bad = dashFields(data as Record<string, unknown>);
    if (bad.length) return NextResponse.json({ error: DASH_MESSAGE, fields: bad }, { status: 400 });
  }
  let doc = null;
  if (op === "create") {
    doc = await Model.create(data);
  } else if (op === "update") {
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    doc = await Model.findByIdAndUpdate(body.id, data, { new: true });
  } else if (op === "delete") {
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await Model.findByIdAndDelete(body.id);
  } else {
    return NextResponse.json({ error: "Unknown op" }, { status: 400 });
  }
  await refreshPublicCache();
  return NextResponse.json({ ok: true, item: doc ? JSON.parse(JSON.stringify(doc)) : null });
}
