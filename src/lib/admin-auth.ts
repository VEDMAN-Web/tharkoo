import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/server/auth/http";
import { isStaffRole, userFromToken, type PublicUser } from "@/server/auth/service";

export interface Viewer {
  verified: boolean;
  kind: "person";
  email: string;
  name: string;
  roles: string[];
}

const anonymous: Viewer = { verified: false, kind: "person", email: "", name: "", roles: [] };

function viewerFrom(user: PublicUser | null): Viewer {
  if (!user) return anonymous;
  return {
    verified: true,
    kind: "person",
    email: user.email,
    name: user.displayName,
    roles: user.roles,
  };
}

export function isStaff(identity: Viewer): identity is Viewer & { verified: true } {
  return identity.verified && isStaffRole(identity.roles);
}

export function adminUnauthorized() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

async function tokenFromCookies() {
  try {
    const jar = await cookies();
    return jar.get(SESSION_COOKIE)?.value;
  } catch {
    return undefined;
  }
}

export async function getStaffFromHeaders() {
  const found = await userFromToken(await tokenFromCookies());
  return viewerFrom(found?.user ?? null);
}

export async function getStaffFromRequest(req: NextRequest) {
  const found = await userFromToken(req.cookies.get(SESSION_COOKIE)?.value);
  return viewerFrom(found?.user ?? null);
}

export async function requireStaffRequest(req: NextRequest) {
  const identity = await getStaffFromRequest(req);
  if (!isStaff(identity)) return null;
  return identity;
}
