import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireStaffRequest } from "@/lib/admin-auth";
import { assertOrigin } from "@/server/auth/http";
import { HttpError } from "@/server/http";
import { actorForStaff, storeAdminMedia } from "@/server/listings/admin-create";
import { VIDEO_MAX_BYTES } from "@/server/media/config";

export const dynamic = "force-dynamic";

/**
 * One photo or video for an ad that staff are creating. `ownerEmail` is the account the file belongs to
 * (blank means the staff account). Staff only, and audited with the staff member and the owner.
 */
export async function POST(request: NextRequest) {
  try {
    assertOrigin(request);
    const staff = await requireStaffRequest(request);
    if (!staff) return NextResponse.json({ ok: false, error: "Sign in as an admin to add photos" }, { status: 403 });
    const actor = await actorForStaff(staff);
    if (!actor) return NextResponse.json({ ok: false, error: "Sign in as an admin to add photos" }, { status: 403 });
    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind") === "video" ? "video" : "image";
    const ownerEmail = String(form.get("ownerEmail") ?? "");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Choose a file" }, { status: 400 });
    if (file.size > VIDEO_MAX_BYTES) return NextResponse.json({ ok: false, error: "Files can be at most 10 MB" }, { status: 413 });
    const result = await storeAdminMedia(
      actor,
      ownerEmail,
      kind,
      { name: file.name, type: file.type, data: Buffer.from(await file.arrayBuffer()) },
      randomUUID(),
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("admin ad media upload failed", error);
    return NextResponse.json({ ok: false, error: "Upload failed. Nothing was saved for this file." }, { status: 500 });
  }
}
