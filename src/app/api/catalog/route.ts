import { NextRequest, NextResponse } from "next/server";
import { getAttributeGroups, getCategories, getCreditPacks } from "@/lib/queries";
import { allowRequest, clientKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!allowRequest(`catalog:${clientKey(req.headers)}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const [categories, attributes, packs] = await Promise.all([
    getCategories(),
    getAttributeGroups(),
    getCreditPacks(),
  ]);
  return NextResponse.json({
    categories,
    attributes,
    packs,
  });
}
