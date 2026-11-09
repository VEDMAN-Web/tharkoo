import { NextRequest, NextResponse } from "next/server";
import { isStaff, requireStaffRequest } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const identity = await requireStaffRequest(req);
  if (!identity || !isStaff(identity)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ ok: true, email: identity.email });
}

export async function POST() {
  return NextResponse.json({ error: "Use Cursor sign-in for staff access" }, { status: 405 });
}
