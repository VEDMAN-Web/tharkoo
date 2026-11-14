import { NextRequest, NextResponse } from "next/server";
import { requireStaffRequest } from "@/lib/admin-auth";
import { assertOrigin } from "@/server/auth/http";
import { HttpError } from "@/server/http";
import { recordImportPhoto } from "@/server/import/job";
import { MAX_BYTES } from "@/server/media/config";
import { connectDb } from "@/lib/db";
import { User } from "@/server/models";

export const dynamic = "force-dynamic";

/** One chosen image of an import job. The page sends the files three at a time. */
export async function POST(request: NextRequest) {
  try {
    assertOrigin(request);
    const staff = await requireStaffRequest(request);
    if (!staff) return NextResponse.json({ ok: false, error: "Sign in as staff to import photos" }, { status: 403 });
    const form = await request.formData();
    const file = form.get("file");
    const jobId = form.get("jobId");
    if (!(file instanceof File) || typeof jobId !== "string") {
      return NextResponse.json({ ok: false, error: "Choose an image file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "Photos can be at most 8 MB" }, { status: 413 });
    await connectDb();
    const user = await User.findOne({ email: staff.email }).select("_id").lean<{ _id: { toString(): string } }>();
    if (!user) return NextResponse.json({ ok: false, error: "Sign in as staff to import photos" }, { status: 403 });
    const result = await recordImportPhoto(
      { id: user._id.toString(), roles: staff.roles },
      jobId,
      { name: file.name, type: file.type, data: Buffer.from(await file.arrayBuffer()) },
      crypto.randomUUID(),
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("import photo upload failed", error);
    return NextResponse.json({ ok: false, error: "Upload failed. Nothing was saved for this photo." }, { status: 500 });
  }
}
