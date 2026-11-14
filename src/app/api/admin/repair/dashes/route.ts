import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminUnauthorized, requireStaffRequest } from "@/lib/admin-auth";
import { repairDashes } from "@/server/content/dash-repair";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Superadmin only: replaces em and en dashes in stored site text (relay #42). Idempotent. */
export async function POST(req: NextRequest) {
  const identity = await requireStaffRequest(req);
  if (!identity || !identity.roles.includes("superadmin")) return adminUnauthorized();
  const result = await repairDashes(randomUUID());
  return NextResponse.json({ ok: true, ...result });
}
