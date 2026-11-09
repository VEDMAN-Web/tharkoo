import { NextResponse } from "next/server";
import { getAttributeGroups, getCategories, getCreditPacks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
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
