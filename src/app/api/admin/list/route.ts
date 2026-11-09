import { NextRequest, NextResponse } from "next/server";
import { adminUnauthorized, isAdminRequest } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { MODEL_MAP, type ModelName } from "@/lib/models";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return adminUnauthorized();
  const modelName = req.nextUrl.searchParams.get("model") as ModelName;
  if (!modelName || !MODEL_MAP[modelName]) {
    return NextResponse.json({ error: "Unknown model" }, { status: 400 });
  }
  await connectDb();
  const limit = Number(req.nextUrl.searchParams.get("limit") || 200);
  const items = await MODEL_MAP[modelName].find().limit(limit).lean();
  return NextResponse.json({ items: JSON.parse(JSON.stringify(items)) });
}
