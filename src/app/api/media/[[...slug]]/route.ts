import { z } from "zod";
import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { requireUser } from "@/server/auth/service";
import { NotFoundError, handle, parseInput, requestIdFrom, success } from "@/server/http";
import { completeMedia, deleteMedia, getMedia, reorderMedia, saveLocalMedia, signMedia } from "@/server/media/service";
import { completeStaffUpload, signStaffUpload } from "@/server/media/staff-upload";
import { mediaCompleteBodySchema, mediaReorderBodySchema, mediaSignBodySchema } from "@/server/shared/schemas/listings";

/** H13.1: staff direct upload. The answer of a refused file is JSON with a plain sentence, so the screen can show it. */
const staffSignSchema = z.object({
  purpose: z.enum(["ad", "library", "import"]),
  kind: z.enum(["image", "video"]),
  contentType: z.string().min(1).max(100),
  byteSize: z.number().int().min(1),
  ownerEmail: z.string().max(200).optional(),
  jobId: z.string().max(40).optional(),
  categoryId: z.string().max(40).optional(),
});
const staffCompleteSchema = z.object({
  purpose: z.enum(["ad", "library", "import"]),
  mediaId: z.string().min(1).max(40),
  fileName: z.string().max(260).optional(),
  alt: z.string().max(400).optional(),
  tags: z.string().max(400).optional(),
  autoAlt: z.boolean().optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pathOf(request: Request) {
  return new URL(request.url).pathname.replace(/\/+$/, "").replace(/^\/api\/media\/?/, "");
}

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  assertOrigin(request);
  const path = pathOf(request);
  const { user } = await requireUser(readCookie(request, SESSION_COOKIE));
  if (request.method === "POST" && path === "local") {
    const form = await request.formData();
    const file = form.get("file");
    const mediaId = String(form.get("mediaId") || "");
    if (!(file instanceof File) || !mediaId) throw new NotFoundError("Upload was not found");
    const saved = await saveLocalMedia(user.id, mediaId, { type: file.type, data: Buffer.from(await file.arrayBuffer()) }, requestId);
    return Response.json(success(saved, requestId), { headers: { "x-request-id": requestId } });
  }
  const body = request.method === "GET" ? undefined : await request.json().catch(() => undefined);
  let data: unknown;
  if (request.method === "POST" && path === "sign") data = await signMedia(user.id, parseInput(mediaSignBodySchema, body), requestId);
  else if (request.method === "POST" && path === "complete") {
    data = await completeMedia(user.id, parseInput(mediaCompleteBodySchema, body).mediaId, requestId);
  } else if (request.method === "POST" && path === "staff-sign") {
    data = await signStaffUpload({ id: user.id, email: user.email, roles: user.roles }, parseInput(staffSignSchema, body), requestId);
  } else if (request.method === "POST" && path === "staff-complete") {
    data = await completeStaffUpload({ id: user.id, email: user.email, roles: user.roles }, parseInput(staffCompleteSchema, body), requestId);
  } else if (request.method === "PATCH" && path === "reorder") {
    data = await reorderMedia(user.id, parseInput(mediaReorderBodySchema, body), requestId);
  } else if (request.method === "GET" && path && !path.includes("/")) data = await getMedia(user.id, user.roles, path);
  else if (request.method === "DELETE" && path && !path.includes("/")) data = await deleteMedia(user.id, path, requestId);
  else throw new NotFoundError("Not found");
  return Response.json(success(data, requestId), { headers: { "x-request-id": requestId } });
}

export const GET = handle(dispatch);
export const POST = handle(dispatch);
export const PATCH = handle(dispatch);
export const DELETE = handle(dispatch);
