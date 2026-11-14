import { NextRequest } from "next/server";
import { SESSION_COOKIE, readCookie } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { HttpError, NotFoundError, UnauthorizedError } from "@/server/http";
import { attachmentFor } from "@/server/support/attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streams one screenshot to a viewer who may see it. Anyone else gets a 404, so the route never
 * confirms that an attachment exists. Responses are private and never cached by shared caches.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const found = await userFromToken(readCookie(request, SESSION_COOKIE));
    if (!found) throw new UnauthorizedError("Sign in required");
    const attachment = await attachmentFor({ id: found.user.id, roles: found.user.roles }, id);
    if (!attachment) throw new NotFoundError("Attachment not found");
    return new Response(new Uint8Array(attachment.data), {
      headers: {
        "content-type": attachment.contentType,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-disposition": "inline",
      },
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError ? error.message : "Something went wrong";
    return Response.json({ ok: false, data: null, error: { code: error instanceof HttpError ? error.code : "INTERNAL", message } }, { status });
  }
}
