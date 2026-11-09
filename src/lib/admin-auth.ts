import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export function adminUnauthorized() {
  return NextResponse.json({ error: "Admin login required" }, { status: 401 });
}

export function isAdminRequest(req: NextRequest) {
  return req.cookies.get("tharkoo_admin")?.value === "1";
}

export async function isAdminCookie() {
  const jar = await cookies();
  return jar.get("tharkoo_admin")?.value === "1";
}
