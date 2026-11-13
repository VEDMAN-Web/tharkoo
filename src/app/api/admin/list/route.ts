import { NextRequest, NextResponse } from "next/server";
import type { Model as MongooseModel } from "mongoose";
import { adminUnauthorized, requireStaffRequest } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { canUseModel } from "@/lib/admin-model-access";
import { MODEL_MAP, type ModelName } from "@/lib/models";
import { auditAdminDenial } from "@/server/admin/denials";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const identity = await requireStaffRequest(req);
  if (!identity) return adminUnauthorized();
  const modelName = req.nextUrl.searchParams.get("model") as ModelName;
  if (!modelName || !MODEL_MAP[modelName]) {
    return NextResponse.json({ error: "Unknown model" }, { status: 400 });
  }
  await connectDb();
  if (!canUseModel(identity.roles, modelName, "read")) {
    await auditAdminDenial(identity, modelName, "list");
    return adminUnauthorized();
  }
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 200), 200);
  const Model = MODEL_MAP[modelName] as unknown as MongooseModel<Record<string, unknown>>;
  const items = await Model.find().limit(limit).lean();
  return NextResponse.json({ items: JSON.parse(JSON.stringify(items)) });
}
