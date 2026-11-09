import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getIdentity, type Identity } from "../../cursor/identity";

export function adminUnauthorized() {
  return NextResponse.json({ error: "Sign in required" }, { status: 401 });
}

export function isStaff(identity: Identity) {
  return identity.verified === true && identity.kind === "person";
}

export async function getStaffFromHeaders() {
  return getIdentity(await headers());
}

export async function getStaffFromRequest(req: NextRequest) {
  return getIdentity(req);
}

export async function requireStaffRequest(req: NextRequest) {
  const identity = await getStaffFromRequest(req);
  if (!isStaff(identity)) return null;
  return identity;
}
