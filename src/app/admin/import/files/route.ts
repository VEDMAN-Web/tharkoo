import { NextRequest, NextResponse } from "next/server";
import { requireStaffRequest } from "@/lib/admin-auth";
import { assertOrigin } from "@/server/auth/http";
import { HttpError } from "@/server/http";
import { recordImportPhoto, recordImportVideo } from "@/server/import/job";
import { MAX_BYTES, VIDEO_MAX_BYTES, optionalCloudinary } from "@/server/media/config";
import { prepareLocalAdFile } from "@/server/media/watermark";
import { connectDb } from "@/lib/db";
import { User } from "@/server/models";

export const dynamic = "force-dynamic";

/** One chosen photo or video of an import job. The page sends them three at a time. `kind` is "video" for a video. */
export async function POST(request: NextRequest) {
  try {
    assertOrigin(request);
    const staff = await requireStaffRequest(request);
    if (!staff) return NextResponse.json({ ok: false, error: "Sign in as staff to import files" }, { status: 403 });
    const form = await request.formData();
    const file = form.get("file");
    const jobId = form.get("jobId");
    if (!(file instanceof File) || typeof jobId !== "string") {
      return NextResponse.json({ ok: false, error: "Choose a photo or video file" }, { status: 400 });
    }
    const isVideo = form.get("kind") === "video";
    if (file.size > (isVideo ? VIDEO_MAX_BYTES : MAX_BYTES)) {
      const error = isVideo ? "Videos can be at most 10 MB" : "Images can be at most 8 MB";
      return NextResponse.json({ ok: false, error }, { status: 413 });
    }
    await connectDb();
    const user = await User.findOne({ email: staff.email }).select("_id").lean<{ _id: { toString(): string } }>();
    if (!user) return NextResponse.json({ ok: false, error: "Sign in as staff to import files" }, { status: 403 });
    const actor = { id: user._id.toString(), roles: staff.roles };
    const raw = Buffer.from(await file.arrayBuffer());
    // H6.18: with no Cloudinary (local disk), the photo is marked here before it is stored; a video is refused while the watermark is on.
    const data = optionalCloudinary() ? raw : (await prepareLocalAdFile(isVideo ? "video" : "image", { type: file.type, data: raw })).data;
    const chosen = { name: file.name, type: file.type, data };
    const result = isVideo
      ? await recordImportVideo(actor, jobId, chosen, crypto.randomUUID())
      : await recordImportPhoto(actor, jobId, chosen, crypto.randomUUID());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("import file upload failed", error);
    return NextResponse.json({ ok: false, error: "Upload failed. Nothing was saved for this file." }, { status: 500 });
  }
}
