import { NextRequest, NextResponse } from "next/server";
import { adminUnauthorized, requireStaffRequest } from "@/lib/admin-auth";
import { getAdminCounts } from "@/server/admin/counts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const identity = await requireStaffRequest(req);
  if (!identity) return adminUnauthorized();
  const counts = await getAdminCounts(identity.roles);
  return NextResponse.json({ ok: true, data: { counts } }, { headers: { "Cache-Control": "no-store" } });
}
