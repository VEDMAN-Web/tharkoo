import { NextRequest, NextResponse } from "next/server";
import { adminUnauthorized, requireStaffRequest } from "@/lib/admin-auth";
import { searchAdmin } from "@/server/admin/search";

export const dynamic = "force-dynamic";

/** The admin top bar search (H8.49): grouped results for the signed-in staff member, only from screens their role may open. */
export async function GET(req: NextRequest) {
  const identity = await requireStaffRequest(req);
  if (!identity) return adminUnauthorized();
  const groups = await searchAdmin(identity.roles, req.nextUrl.searchParams.get("q"));
  return NextResponse.json({ ok: true, data: { groups } }, { headers: { "Cache-Control": "no-store" } });
}
