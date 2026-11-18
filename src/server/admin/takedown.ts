import { Types } from "mongoose";
import { dateWords } from "@/lib/admin/history-words";
import { connectDb } from "@/lib/db";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { NotFoundError, ValidationError } from "@/server/http";
import { Listing, Report } from "@/server/models";
import { DEFAULT_DUE_HOURS, TAKEDOWN_CHANNELS, adKeyOf, type TakedownChannel } from "@/server/admin/takedown-rules";

/**
 * H7.173: staff add a legal takedown request that arrived outside the site (an email, a letter). It goes into the Legal takedown queue
 * with the due time showing. One audited write; the ad itself is not touched until someone acts on the request.
 */

const HOUR_MS = 60 * 60 * 1000;
const WHO_MAX = 120;
const REASON_MAX = 1000;

export { DEFAULT_DUE_HOURS };
export type TakedownInput = { ad: string; askedBy: string; channel: string; reason: string; receivedAt: string; dueAt: string };

function dateOf(value: string, label: string): Date {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new ValidationError(`Choose ${label}.`);
  return date;
}

export async function addTakedown(ctx: AdminCtx, input: TakedownInput): Promise<{ id: string; eventId: string }> {
  await connectDb();
  const key = adKeyOf(input.ad);
  if (!key) throw new ValidationError("Paste the link of the ad, or its ID.");
  const askedBy = String(input.askedBy ?? "").replace(/\s+/g, " ").trim();
  if (!askedBy) throw new ValidationError("Write who asked.");
  if (askedBy.length > WHO_MAX) throw new ValidationError(`Keep who asked to ${WHO_MAX} characters.`);
  if (!(TAKEDOWN_CHANNELS as readonly string[]).includes(input.channel)) throw new ValidationError("Choose how it arrived.");
  const reason = String(input.reason ?? "").trim();
  if (!reason) throw new ValidationError("Write the reason.");
  if (reason.length > REASON_MAX) throw new ValidationError(`Keep the reason to ${REASON_MAX} characters.`);
  const receivedAt = dateOf(input.receivedAt, "the date it was received");
  const dueAt = dateOf(input.dueAt, "the due date and time");
  if (dueAt.getTime() <= receivedAt.getTime()) throw new ValidationError("The due time must be after it was received.");
  if (receivedAt.getTime() > Date.now() + HOUR_MS) throw new ValidationError("It cannot have been received in the future.");

  const listing = await Listing.findOne(Types.ObjectId.isValid(key) ? { $or: [{ _id: key }, { slug: key }] } : { slug: key }).select("title slug").lean<{ _id: Types.ObjectId; title?: string; slug?: string } | null>();
  if (!listing) throw new NotFoundError("No ad matches that link or ID.");
  const label = (listing.title ?? listing.slug ?? "ad").slice(0, 60);

  const written = await adminWrite<{ id: string }>(ctx, {
    perm: "reports.legal",
    action: "report.takedown.add",
    target: { type: "Report", id: String(listing._id), label },
    texts: [askedBy, reason],
    before: async () => null,
    apply: async () => {
      const created = await Report.create({
        listingId: listing._id,
        reason: "other",
        details: reason,
        severity: "S1",
        status: "open",
        source: "legal",
        askedBy,
        channel: input.channel as TakedownChannel,
        slaAckDueAt: dueAt,
        createdAt: receivedAt,
      });
      return { after: { askedBy, channel: input.channel, receivedAt: receivedAt.toISOString(), dueAt: dueAt.toISOString() }, result: { id: String(created._id) }, summary: `Added a legal takedown request on “${label}”, due ${dateWords(dueAt)}` };
    },
  });
  return { id: written.result.id, eventId: written.eventId };
}
