import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { objectId } from "@/server/billing/ledger";
import { postTransaction } from "@/server/ledger/service";
import { ConflictError, ForbiddenError, NotFoundError, PaymentRequiredError, ValidationError, isDuplicateKey } from "@/server/http";
import { mailerFromEnv } from "@/server/mailer";
import { Category, Listing, User } from "@/server/models";
import { CATEGORY_KINDS, type CategoryKind } from "@/server/models/catalog";
import { VideoTour, type VideoTourDoc } from "@/server/tours/model";
import { videoRoomProvider } from "@/server/tours/room";
import { holdInEscrow, refundEscrow, releaseEscrow } from "@/server/wallet/escrow";
import { videoTourPrice } from "@/server/wallet/listing-guard";

const audit = new AuditRepository();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A call shorter than this is refunded, not paid. */
export const TOUR_MIN_SECONDS = 120;
/** A request the advertiser does not accept in this time is refunded. */
export const TOUR_ACCEPT_WINDOW_MS = 30 * MINUTE;
/** An accepted tour with no call-end event after this long is refunded. */
export const TOUR_CALL_TIMEOUT_MS = 4 * HOUR;
/** A disputed call must be reported within this time after it ends. */
export const TOUR_DISPUTE_WINDOW_MS = 48 * HOUR;
/** The "Video verified" badge lasts this long after a paid call. */
export const TOUR_VERIFIED_MS = 90 * DAY;
/** This many reversed disputes switch live tours off for that advertiser. */
export const TOUR_REVERSALS_TO_SWITCH_OFF = 3;

/** Staff who may reverse a disputed tour. */
const REVERSE_ROLES = ["trust_safety", "finance", "admin", "superadmin"];

interface Party {
  ownerId?: string;
  userId?: string;
}

interface Escrow {
  requestId: string;
  ip?: string;
}

function iso(value: Date | null | undefined) {
  return value ? new Date(value).toISOString() : null;
}

function present(row: VideoTourDoc & { _id?: unknown }) {
  return {
    id: String(row._id),
    listingId: String(row.listingId),
    ownerId: String(row.ownerId),
    userId: String(row.userId),
    coins: row.coins,
    status: row.status,
    requestedAt: iso(row.requestedAt),
    acceptedAt: iso(row.acceptedAt),
    endedAt: iso(row.endedAt),
    durationSeconds: row.durationSeconds ?? null,
    failureReason: row.failureReason || null,
    disputedAt: iso(row.disputedAt),
    reversedAt: iso(row.reversedAt),
  };
}

function escrowFor(tour: VideoTourDoc & { _id?: unknown }, input: Escrow) {
  return {
    userId: String(tour.userId),
    vendorId: String(tour.ownerId),
    coins: tour.coins,
    bookingId: String(tour._id),
    requestId: input.requestId,
    ip: input.ip,
  };
}

async function tourFor(tourId: string, party: Party) {
  const tour = await VideoTour.findById(objectId(tourId, "tourId")).lean();
  if (!tour) throw new NotFoundError("Not found");
  if (party.ownerId && String(tour.ownerId) !== party.ownerId) throw new NotFoundError("Not found");
  if (party.userId && String(tour.userId) !== party.userId) throw new NotFoundError("Not found");
  return tour;
}

async function assertAdvertiserCanTour(ownerId: string) {
  const reversed = await VideoTour.countDocuments({ ownerId, status: "reversed" });
  if (reversed >= TOUR_REVERSALS_TO_SWITCH_OFF) {
    throw new ForbiddenError("Live video tours are switched off for this advertiser");
  }
}

async function notifyAdvertiser(ownerId: string, title: string) {
  try {
    const owner = await User.findById(ownerId).select("email").lean();
    if (!owner?.email) return;
    await mailerFromEnv().send({
      to: owner.email,
      subject: "A buyer asked for a live video tour",
      text: `A buyer asked for a live video tour of "${title}". Open your dashboard to accept or decline. The request expires in 30 minutes.`,
    });
  } catch (error) {
    console.error("video tour email could not be sent", error);
  }
}

/** A buyer asks for a tour. The coin moves into escrow now and is paid out or refunded later. */
export async function requestTour(input: { userId: string; listingId: string } & Escrow) {
  await connectDb();
  await VideoTour.init();
  const listingId = objectId(input.listingId, "listingId");
  const listing = await Listing.findById(listingId).select("ownerId status title").lean();
  if (!listing || listing.status !== "active") throw new NotFoundError("Not found");
  const ownerId = String(listing.ownerId);
  if (ownerId === input.userId) {
    throw new ValidationError("Invalid request", { listingId: ["You cannot book a tour of your own ad"] });
  }
  await assertAdvertiserCanTour(ownerId);
  const coins = await videoTourPrice(String(listingId));
  const tourId = new mongoose.Types.ObjectId();
  try {
    await VideoTour.create({
      _id: tourId,
      listingId,
      ownerId: listing.ownerId,
      userId: objectId(input.userId, "userId"),
      coins,
      status: "requested",
      requestedAt: new Date(),
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw new ConflictError("You already have an open tour request for this ad");
    throw error;
  }
  try {
    await holdInEscrow({
      userId: input.userId,
      vendorId: ownerId,
      coins,
      bookingId: String(tourId),
      listingId: String(listingId),
      requestId: input.requestId,
      ip: input.ip,
    });
  } catch (error) {
    await VideoTour.updateOne({ _id: tourId, status: "requested" }, { $set: { status: "failed", failureReason: "hold-refused" } });
    throw error;
  }
  await audit.append({
    actorId: input.userId,
    actorType: "user",
    action: "video_tour.request",
    targetType: "video_tour",
    targetId: String(tourId),
    requestId: input.requestId,
    after: { listingId: String(listingId), coins },
  });
  await notifyAdvertiser(ownerId, listing.title);
  return present((await VideoTour.findById(tourId).lean()) as VideoTourDoc);
}

/** The advertiser accepts and gets a room. Refused after the 30-minute window (the coin is refunded then). */
export async function acceptTour(input: { ownerId: string; tourId: string; requestId: string }) {
  await connectDb();
  const tour = await tourFor(input.tourId, { ownerId: input.ownerId });
  if (tour.status !== "requested") throw new ConflictError("This tour request is no longer open");
  if (Date.now() - new Date(tour.requestedAt).getTime() > TOUR_ACCEPT_WINDOW_MS) {
    await closeTour(tour, { from: "requested", to: "expired", reason: "not-accepted", requestId: input.requestId });
    throw new ConflictError("This tour request has expired");
  }
  const room = videoRoomProvider().createRoom({ tourId: String(tour._id) });
  const claim = await VideoTour.findOneAndUpdate(
    { _id: tour._id, status: "requested" },
    { $set: { status: "accepted", acceptedAt: new Date(), roomId: room.roomId } },
    { returnDocument: "after" },
  ).lean();
  if (!claim) throw new ConflictError("This tour request is no longer open");
  await audit.append({
    actorId: input.ownerId,
    actorType: "user",
    action: "video_tour.accept",
    targetType: "video_tour",
    targetId: String(tour._id),
    requestId: input.requestId,
  });
  return { ...present(claim), joinUrl: room.joinUrl };
}

/** The advertiser declines: the whole hold goes back to the buyer. */
export async function declineTour(input: { ownerId: string; tourId: string; requestId: string }) {
  await connectDb();
  const tour = await tourFor(input.tourId, { ownerId: input.ownerId });
  const claim = await VideoTour.findOneAndUpdate(
    { _id: tour._id, status: "requested" },
    { $set: { status: "declined", endedAt: new Date(), failureReason: "declined" } },
    { returnDocument: "after" },
  ).lean();
  if (!claim) throw new ConflictError("This tour request is no longer open");
  try {
    await refundEscrow(escrowFor(tour, input));
  } catch (error) {
    await VideoTour.updateOne({ _id: tour._id, status: "declined" }, { $set: { status: "requested", endedAt: null, failureReason: "" } });
    throw error;
  }
  await audit.append({
    actorId: input.ownerId,
    actorType: "user",
    action: "video_tour.decline",
    targetType: "video_tour",
    targetId: String(tour._id),
    requestId: input.requestId,
  });
  return present(claim);
}

/**
 * Moves an open tour to a closed status and refunds the hold. The claim is atomic, so a second run changes nothing.
 * Returns false when the tour was no longer in the expected status.
 */
async function closeTour(
  tour: VideoTourDoc & { _id?: unknown },
  input: { from: "requested" | "accepted"; to: "expired" | "failed"; reason: string; requestId: string },
) {
  const claim = await VideoTour.findOneAndUpdate({ _id: tour._id, status: input.from }, { $set: { status: "ending" } }, { returnDocument: "before" }).lean();
  if (!claim) return false;
  try {
    await refundEscrow(escrowFor(tour, { requestId: input.requestId }));
  } catch (error) {
    await VideoTour.updateOne({ _id: tour._id, status: "ending" }, { $set: { status: input.from } });
    throw error;
  }
  await VideoTour.updateOne({ _id: tour._id, status: "ending" }, { $set: { status: input.to, failureReason: input.reason, endedAt: new Date() } });
  await audit.append({
    actorType: "system",
    action: "video_tour.refund",
    targetType: "video_tour",
    targetId: String(tour._id),
    requestId: input.requestId,
    after: { reason: input.reason, status: input.to },
  });
  return true;
}

/**
 * The call provider reports that a call ended. A call of at least two minutes is paid to the advertiser
 * and the ad gets the verified badge; anything else is refunded. Only the first event for a tour counts.
 */
export async function endTour(input: { tourId: string; eventId: string; outcome: "ended" | "failed"; durationSeconds?: number; requestId: string }) {
  await connectDb();
  const id = objectId(input.tourId, "tourId");
  const duration = input.durationSeconds ?? 0;
  const claim = await VideoTour.findOneAndUpdate(
    { _id: id, status: "accepted" },
    { $set: { status: "ending", eventId: input.eventId, endedAt: new Date(), durationSeconds: duration } },
    { returnDocument: "before" },
  ).lean();
  if (!claim) return { received: true as const };
  const paid = input.outcome === "ended" && duration >= TOUR_MIN_SECONDS;
  try {
    await (paid ? releaseEscrow(escrowFor(claim, input)) : refundEscrow(escrowFor(claim, input)));
  } catch (error) {
    await VideoTour.updateOne({ _id: id, status: "ending" }, { $set: { status: "accepted", eventId: "", endedAt: null, durationSeconds: null } });
    throw error;
  }
  const reason = paid ? "" : input.outcome === "failed" ? "call-failed" : "call-too-short";
  await VideoTour.updateOne({ _id: id, status: "ending" }, { $set: { status: paid ? "completed" : "failed", failureReason: reason } });
  if (paid) {
    await Listing.updateOne({ _id: claim.listingId }, { $set: { videoVerifiedUntil: new Date(Date.now() + TOUR_VERIFIED_MS) } });
  }
  await audit.append({
    actorType: "system",
    action: paid ? "video_tour.complete" : "video_tour.refund",
    targetType: "video_tour",
    targetId: String(id),
    requestId: input.requestId,
    after: { duration, outcome: input.outcome },
  });
  return { received: true as const };
}

/** Run by the cron job: refunds requests nobody accepted in time, and accepted tours whose call never reported an end. */
export async function expireDueTours(requestId: string) {
  await connectDb();
  const now = Date.now();
  const stale = await VideoTour.find({
    $or: [
      { status: "requested", requestedAt: { $lt: new Date(now - TOUR_ACCEPT_WINDOW_MS) } },
      { status: "accepted", acceptedAt: { $lt: new Date(now - TOUR_CALL_TIMEOUT_MS) } },
    ],
  })
    .limit(200)
    .lean();
  let expired = 0;
  for (const tour of stale) {
    const isRequest = tour.status === "requested";
    const closed = await closeTour(tour, {
      from: isRequest ? "requested" : "accepted",
      to: isRequest ? "expired" : "failed",
      reason: isRequest ? "not-accepted" : "call-not-ended",
      requestId,
    });
    if (closed) expired += 1;
  }
  return { toursClosed: expired };
}

/** The buyer reports a completed call within 48 hours. The coin stays in the advertiser's earnings until staff decide. */
export async function disputeTour(input: { userId: string; tourId: string; reason: string; requestId: string }) {
  await connectDb();
  const tour = await tourFor(input.tourId, { userId: input.userId });
  if (tour.status !== "completed") throw new ConflictError("Only a completed call can be disputed");
  if (!tour.endedAt || Date.now() - new Date(tour.endedAt).getTime() > TOUR_DISPUTE_WINDOW_MS) {
    throw new ConflictError("The 48-hour dispute window has closed");
  }
  const claim = await VideoTour.findOneAndUpdate(
    { _id: tour._id, status: "completed" },
    { $set: { status: "disputed", disputedAt: new Date(), disputeReason: input.reason.slice(0, 500) } },
    { returnDocument: "after" },
  ).lean();
  if (!claim) throw new ConflictError("Only a completed call can be disputed");
  await audit.append({
    actorId: input.userId,
    actorType: "user",
    action: "video_tour.dispute",
    targetType: "video_tour",
    targetId: String(tour._id),
    requestId: input.requestId,
  });
  return present(claim);
}

/** Staff reverse a disputed tour: the coin goes from the advertiser's earnings back to the buyer's wallet. */
export async function reverseTour(input: { actorId: string; roles: readonly string[]; tourId: string; requestId: string }) {
  if (!input.roles.some((role) => REVERSE_ROLES.includes(role))) {
    throw new ForbiddenError("Your staff role does not reverse tours");
  }
  await connectDb();
  const id = objectId(input.tourId, "tourId");
  const claim = await VideoTour.findOneAndUpdate({ _id: id, status: "disputed" }, { $set: { status: "reversing" } }, { returnDocument: "before" }).lean();
  if (!claim) throw new ConflictError("Only a disputed tour can be reversed");
  try {
    await postTransaction({
      idempotencyKey: `tour-reverse:${id}`,
      kind: "video_tour_reversal",
      refType: "video_tour",
      refId: String(id),
      moves: [
        { account: "vendor_earnings", ownerKey: String(claim.ownerId), delta: -claim.coins },
        { account: "user_wallet", ownerKey: String(claim.userId), delta: claim.coins },
      ],
      requestId: input.requestId,
      actorId: input.actorId,
      actorType: "admin",
    });
  } catch (error) {
    await VideoTour.updateOne({ _id: id, status: "reversing" }, { $set: { status: "disputed" } });
    if (error instanceof PaymentRequiredError) {
      throw new ConflictError("The advertiser has already withdrawn these coins; handle it by hand");
    }
    throw error;
  }
  await VideoTour.updateOne({ _id: id, status: "reversing" }, { $set: { status: "reversed", reversedAt: new Date() } });
  await Listing.updateOne({ _id: claim.listingId }, { $set: { videoVerifiedUntil: null } });
  await audit.append({
    actorId: input.actorId,
    actorType: "admin",
    action: "video_tour.reverse",
    targetType: "video_tour",
    targetId: String(id),
    requestId: input.requestId,
    after: { coins: claim.coins },
  });
  return present((await VideoTour.findById(id).lean()) as VideoTourDoc);
}

/** The tours a user is part of, as buyer or advertiser. */
export async function listTours(userId: string) {
  await connectDb();
  const rows = await VideoTour.find({ $or: [{ userId }, { ownerId: userId }] })
    .sort({ requestedAt: -1 })
    .limit(50)
    .lean();
  return rows.map((row) => {
    const isAdvertiser = String(row.ownerId) === userId;
    const joinUrl = isAdvertiser && row.roomId ? videoRoomProvider().joinUrlFor(row.roomId) : null;
    return { ...present(row), role: isAdvertiser ? "advertiser" : "buyer", joinUrl };
  });
}

export async function listVideoTourCategories() {
  await connectDb();
  const rows = await Category.find({}).select("name slug kind videoTourEnabled videoTourCoins").sort({ order: 1 }).lean();
  return rows.map((row) => ({
    id: String(row._id),
    name: row.name,
    slug: row.slug,
    kind: row.kind ?? null,
    videoTourEnabled: row.videoTourEnabled === true,
    videoTourCoins: row.videoTourCoins ?? 1,
  }));
}

/** Superadmin only. A people category can never have live tours switched on, and switching it to people turns them off. */
export async function updateVideoTourSettings(input: {
  actorId: string;
  roles: readonly string[];
  categoryId: string;
  kind?: CategoryKind;
  enabled?: boolean;
  coins?: number;
  requestId: string;
}) {
  if (!input.roles.includes("superadmin")) throw new ForbiddenError("Only a superadmin changes video tour settings");
  await connectDb();
  const category = await Category.findById(objectId(input.categoryId, "categoryId")).lean();
  if (!category) throw new NotFoundError("Not found");
  const kind = input.kind ?? (category.kind as CategoryKind | undefined) ?? "goods";
  if (!(CATEGORY_KINDS as readonly string[]).includes(kind)) throw new ValidationError("Invalid request", { kind: ["Unknown kind"] });
  if (kind === "people" && input.enabled === true) {
    throw new ValidationError("Invalid request", { enabled: ["Not available for people listings"] });
  }
  const enabled = kind === "people" ? false : (input.enabled ?? category.videoTourEnabled === true);
  const coins = input.coins ?? category.videoTourCoins ?? 1;
  await Category.updateOne({ _id: category._id }, { $set: { kind, videoTourEnabled: enabled, videoTourCoins: coins } });
  await audit.append({
    actorId: input.actorId,
    actorType: "admin",
    action: "video_tours.settings.update",
    targetType: "category",
    targetId: String(category._id),
    requestId: input.requestId,
    before: { kind: category.kind ?? null, videoTourEnabled: category.videoTourEnabled === true, videoTourCoins: category.videoTourCoins ?? 1 },
    after: { kind, videoTourEnabled: enabled, videoTourCoins: coins },
  });
  return { id: String(category._id), kind, videoTourEnabled: enabled, videoTourCoins: coins };
}
