import { NextRequest, NextResponse } from "next/server";
import { requireStaffRequest } from "@/lib/admin-auth";
import { assertOrigin } from "@/server/auth/http";
import { HttpError } from "@/server/http";
import { SITE_MEDIA_MAX_BYTES, uploadSiteMedia } from "@/server/layout/media";

export const dynamic = "force-dynamic";

/** Uploads one staff image. Server actions cap the body at 1 MB, so uploads use this route. */
export async function POST(request: NextRequest) {
  try {
    assertOrigin(request);
    const staff = await requireStaffRequest(request);
    if (!staff) return NextResponse.json({ ok: false, error: "Sign in as staff to upload images" }, { status: 403 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Choose an image file" }, { status: 400 });
    if (file.size > SITE_MEDIA_MAX_BYTES) return NextResponse.json({ ok: false, error: "Images can be at most 8 MB" }, { status: 413 });
    const item = await uploadSiteMedia({
      file: { type: file.type, data: Buffer.from(await file.arrayBuffer()) },
      alt: form.get("alt"),
      fileName: file.name,
      autoAlt: form.get("auto_alt") === "1",
      tags: form.get("tags"),
      email: staff.email,
      roles: staff.roles,
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("site media upload failed", error);
    return NextResponse.json({ ok: false, error: "Upload failed. Nothing was saved." }, { status: 500 });
  }
}
