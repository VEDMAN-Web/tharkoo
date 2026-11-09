import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getIdentity, requireTeamRole, type Identity, type VerifiedIdentity } from "../../cursor/identity";

function hostedIdentityGate() {
  return Boolean(process.env.CURSOR_APP_ID || process.env.VERCEL || process.env.NODE_ENV === "production");
}

export function adminUnauthorized() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function isStaff(identity: Identity): identity is VerifiedIdentity {
  if (!identity.verified) return false;
  if (identity.kind !== "person") return false;
  if (identity.simulated && hostedIdentityGate()) return false;
  if (identity.appVisibility === "team") {
    const allowed = requireTeamRole(identity, ["admin"]);
    return !(allowed instanceof Response);
  }
  return identity.appVisibility === "private";
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
