import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, assertOrigin } from "@/server/auth/http";
import { isStaffRole, userFromToken } from "@/server/auth/service";
import { ForbiddenError } from "@/server/http";
import { isKind, listNotifications, markAllNotificationsRead, markNotificationRead, PANEL_SIZE } from "@/server/admin/notifications";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

async function staffFrom(req: NextRequest) {
  const found = await userFromToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!found || !isStaffRole(found.user.roles)) return null;
  return { id: found.user.id, roles: found.user.roles };
}

/** The bell: the newest items for the signed-in staff member and their unread count. Only what their role may see. */
export async function GET(req: NextRequest) {
  const staff = await staffFrom(req);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  const url = req.nextUrl.searchParams;
  const kind = url.get("kind") ?? "";
  const data = await listNotifications(staff.id, staff.roles, {
    unreadOnly: url.get("filter") === "unread",
    kind: isKind(kind) ? kind : "",
    page: Number(url.get("page")) || 1,
    pageSize: Number(url.get("size")) || PANEL_SIZE,
  });
  return NextResponse.json({ ok: true, data }, { headers: NO_STORE });
}

/** { action: "read", key } marks one item read for this person. { action: "all" } marks everything so far read. */
export async function POST(req: NextRequest) {
  try {
    assertOrigin(req);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
    throw error;
  }
  const staff = await staffFrom(req);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  const body = (await req.json().catch(() => null)) as { action?: string; key?: string } | null;
  if (body?.action === "all") {
    await markAllNotificationsRead(staff.id);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }
  if (body?.action === "read" && typeof body.key === "string") {
    const done = await markNotificationRead(staff.id, staff.roles, body.key);
    return NextResponse.json({ ok: done }, { status: done ? 200 : 400, headers: NO_STORE });
  }
  return NextResponse.json({ ok: false }, { status: 400, headers: NO_STORE });
}
