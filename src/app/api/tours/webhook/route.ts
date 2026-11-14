import { AuditRepository } from "@/server/audit";
import { webhookRejection } from "@/server/billing";
import { json } from "@/server/billing/http";
import { handle, parseInput, requestIdFrom } from "@/server/http";
import { idSchema } from "@/server/shared/schemas/common";
import { endTour } from "@/server/tours/service";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const audit = new AuditRepository();

const endSchema = z.object({
  eventId: z.string().trim().min(1).max(200),
  tourId: idSchema,
  outcome: z.enum(["ended", "failed"]),
  durationSeconds: z.number().int().min(0).max(86_400).optional(),
});

/**
 * The call provider reports how a live tour ended. Same signature and timestamp rule as the payment webhooks;
 * a refused request is recorded by reason only and never reaches the wallet.
 */
async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  const raw = await request.text();
  const refusal = webhookRejection(request, raw);
  if (refusal) {
    await audit.append({
      actorId: null,
      actorType: "system",
      action: "video_tour.webhook.rejected",
      targetType: "webhook",
      targetId: "tours",
      after: { reason: refusal },
      requestId,
    });
    return Response.json(
      { ok: false, data: null, error: { code: "INVALID_SIGNATURE", message: "Invalid webhook signature" } },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }
  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : undefined;
  } catch {
    body = undefined;
  }
  const event = parseInput(endSchema, body);
  return json(await endTour({ ...event, requestId }), requestId);
}

export const POST = handle(dispatch);
