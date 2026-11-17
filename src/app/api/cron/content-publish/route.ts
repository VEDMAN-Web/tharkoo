import { finalizeDue } from "@/server/content/studio/workflow";
import { handle, parseInput, requestIdFrom, success } from "@/server/http";
import { assertCronAuth } from "@/server/shared/cron-auth";
import { cronBodySchema } from "@/server/shared/schemas/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

/**
 * H8.34: finishes the content that was scheduled and is now due (secret header, like the other cron routes). The public already sees
 * a due item by the read rule; this run writes the revision and the audit row and refreshes the pages. Running it late or twice is safe.
 */
async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  assertCronAuth(request);
  parseInput(cronBodySchema, await readBody(request));
  const done = await finalizeDue(requestId);
  return Response.json(success({ contentPublished: done.published, contentSkipped: done.skipped }, requestId), { status: 200, headers: { "x-request-id": requestId } });
}

export const POST = handle(dispatch);
/** Vercel Cron calls with GET and `Authorization: Bearer <CRON_SECRET>`. */
export const GET = handle(dispatch);
