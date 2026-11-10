import { NextRequest, NextResponse } from "next/server";
import type { Model as MongooseModel } from "mongoose";
import { adminUnauthorized, requireStaffRequest } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { MODEL_MAP, type ModelName } from "@/lib/models";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await requireStaffRequest(req))) return adminUnauthorized();
  const modelName = req.nextUrl.searchParams.get("model") as ModelName;
  if (!modelName || !MODEL_MAP[modelName]) {
    return NextResponse.json({ error: "Unknown model" }, { status: 400 });
  }
  await connectDb();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 200), 200);
  const Model = MODEL_MAP[modelName] as unknown as MongooseModel<Record<string, unknown>>;
  const items = await Model.find().limit(limit).lean();
  return NextResponse.json({ items: JSON.parse(JSON.stringify(items)) });
}
