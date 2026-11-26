import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { objectId } from "@/server/billing/ledger";
import { postTransaction } from "@/server/ledger/service";
import { ConflictError, ForbiddenError, NotFoundError, PaymentRequiredError, ValidationError, isDuplicateKey } from "@/server/http";
import { mailerFromEnv } from "@/server/mailer";
import { Category, Listing, MediaAsset, User } from "@/server/models";
import { adPhotoUrl } from "@/server/media/photo-url";
import { kindAllowsVideo, isPeopleListing, listKinds, requireKind, VIDEO_NEVER_FOR_PEOPLE } from "@/server/categories/kinds";
import type { CategoryKind } from "@/server/models/catalog";
import { VideoTour, type VideoTourDoc } from "@/server/tours/model";
import { callPagePath, roomExpiry, TOUR_BOOKED_MINUTES, TOUR_ROOM_GRACE_MINUTES, videoRoomProvider } from "@/server/tours/room";
import { accountName } from "@/lib/account-name";
import { siteUrl } from "@/lib/utils";
import { holdInEscrow, refundEscrow, releaseEscrow } from "@/server/wallet/escrow";
import { readMoneySettings } from "@/server/billing/money-settings";
import { raiseLowCallPrices } from "./min-price";
import { splitCall, TOUR_MIN_PRICE_COINS } from "./split";
import { videoTourPrice } from "@/server/wallet/listing-guard";
import { assertNotPaused } from "@/server/settings/emergency";

const audit = new AuditRepository();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A call shorter than this is refunded, not paid. */
// H18.7 (Vedant, 21 Nov 2026): the vendor is paid the moment both people are connected; there is no minimum length.
export const TOUR_MIN_SECONDS = 0;
/** A request the advertiser does not accept in this time is refunded. */
export const TOUR_ACCEPT_WINDOW_MS = 30 * MINUTE;
/**
 * An accepted tour that never got both people into the room is refunded after this long. The room itself only lives
 * TOUR_BOOKED_MINUTES + TOUR_ROOM_GRACE_MINUTES (40 min) after the accept, so nobody can join later; 5 more minutes cover
 * the minute-by-minute payout check. A call that did connect is already paid and completed, so this never touches it.
 */
export const TOUR_CALL_TIMEOUT_MS = (TOUR_BOOKED_MINUTES + TOUR_ROOM_GRACE_MINUTES + 5) * MINUTE;
/** How long a "vendor is on a call" answer is reused, so a busy list does not ask the video service on every poll. */
const BUSY_CACHE_MS = 15_000;
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
    platformFee: splitCall(tour.coins, tour.feePercent ?? 0).fee,
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

async function notifyBuyer(userId: string, tourId: string) {
  try {
    const buyer = await User.findById(userId).select("email").lean();
    if (!buyer?.email) return;
    await mailerFromEnv().send({
      to: buyer.email,
      subject: "Your live video call is ready",
      text: `The advertiser accepted your live video call. Open it here when you are ready: ${siteUrl()}${callPagePath(tourId)}`,
    });
  } catch (error) {
    console.error("video tour email could not be sent", error);
  }
}

/** A buyer asks for a tour. The coin moves into escrow now and is paid out or refunded later. */
export async function requestTour(input: { userId: string; listingId: string } & Escrow) {
  await connectDb();
  await VideoTour.init();
  await assertNotPaused("pauseVideoCalls");
  const listingId = objectId(input.listingId, "listingId");
  const listing = await Listing.findById(listingId).select("ownerId status title videoCallsOff").lean();
  if (!listing || listing.status !== "active") throw new NotFoundError("Not found");
  // H21.5b: the owner turned video calls off for this ad.
  if (listing.videoCallsOff) throw new ConflictError("Video calls are off for this ad");
  const ownerId = String(listing.ownerId);
  if (ownerId === input.userId) {
    throw new ValidationError("Invalid request", { listingId: ["You cannot book a tour of your own ad"] });
  }
  await assertAdvertiserCanTour(ownerId);
  const coins = await videoTourPrice(String(listingId));
  // H19.10: the share in force now is kept on the call; a later change never touches it.
  const feePercent = (await readMoneySettings()).videoCallSharePercent;
  const tourId = new mongoose.Types.ObjectId();
  try {
    await VideoTour.create({
      _id: tourId,
      listingId,
      ownerId: listing.ownerId,
      userId: objectId(input.userId, "userId"),
      coins,
      feePercent,
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
    after: { listingId: String(listingId), coins, feePercent },
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
  // One advertiser, one call at a time: the next person in the line waits until the running call ends.
  if (await vendorInCall(input.ownerId)) throw new ConflictError("You are on another video call. Accept this one when that call ends.");
  const acceptedAt = new Date();
  const provider = videoRoomProvider();
  const room = await provider.createRoom({ tourId: String(tour._id), expiresAt: roomExpiry(acceptedAt) });
  const claim = await VideoTour.findOneAndUpdate(
    { _id: tour._id, status: "requested" },
    { $set: { status: "accepted", acceptedAt, roomId: room.roomId } },
    { returnDocument: "after" },
  ).lean();
  if (!claim) {
    await provider.deleteRoom(room.roomId);
    throw new ConflictError("This tour request is no longer open");
  }
  await audit.append({
    actorId: input.ownerId,
    actorType: "user",
    action: "video_tour.accept",
    targetType: "video_tour",
    targetId: String(tour._id),
    requestId: input.requestId,
  });
  // A new room now exists, so the next "is this advertiser on a call" check must ask again, not reuse an older answer.
  busyCache.delete(input.ownerId);
  if (room.live) await notifyBuyer(String(tour.userId), String(tour._id));
  return { ...present(claim), joinUrl: room.live ? callPagePath(String(tour._id)) : null };
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
 * The buyer takes a waiting request back, or lets go of an accepted call that nobody has joined yet. The whole hold goes
 * back to their wallet at once. A call that already connected is paid and completed, so it can no longer be cancelled.
 */
export async function cancelTour(input: { userId: string; tourId: string; requestId: string }) {
  await connectDb();
  const tour = await tourFor(input.tourId, { userId: input.userId });
  if (tour.status !== "requested" && tour.status !== "accepted") throw new ConflictError("This video call can no longer be cancelled");
  const closed = await closeTour(tour, { from: tour.status, to: "cancelled", reason: "cancelled-by-buyer", requestId: input.requestId });
  if (!closed) throw new ConflictError("This video call can no longer be cancelled");
  await audit.append({
    actorId: input.userId,
    actorType: "user",
    action: "video_tour.cancel",
    targetType: "video_tour",
    targetId: String(tour._id),
    requestId: input.requestId,
  });
  return present((await VideoTour.findById(tour._id).lean()) as VideoTourDoc);
}

const busyCache = new Map<string, { at: number; busy: boolean }>();

/**
 * True while this advertiser is in a live call: a recent room of theirs holds two people right now (asked from the video
 * service, not from the phones). A call that has ended, or one only one person has joined, is not busy. The answer is
 * reused for a few seconds so many screens polling at once do not each ask the video service.
 */
export async function vendorInCall(ownerId: string): Promise<boolean> {
  const hit = busyCache.get(ownerId);
  if (hit && Date.now() - hit.at < BUSY_CACHE_MS) return hit.busy;
  await connectDb();
  const since = new Date(Date.now() - (TOUR_BOOKED_MINUTES + TOUR_ROOM_GRACE_MINUTES) * MINUTE);
  const rooms = await VideoTour.find({ ownerId, status: { $in: ["accepted", "completed"] }, acceptedAt: { $gte: since }, roomId: { $nin: ["", null] } })
    .select("roomId")
    .sort({ acceptedAt: -1 })
    .limit(3)
    .lean();
  const provider = videoRoomProvider();
  let busy = false;
  for (const room of rooms) {
    if ((await provider.participantCount(String(room.roomId)).catch(() => 0)) >= 2) {
      busy = true;
      break;
    }
  }
  busyCache.set(ownerId, { at: Date.now(), busy });
  return busy;
}

/**
 * Moves an open tour to a closed status and refunds the hold. The claim is atomic, so a second run changes nothing.
 * Returns false when the tour was no longer in the expected status.
 */
async function closeTour(
  tour: VideoTourDoc & { _id?: unknown },
  input: { from: "requested" | "accepted"; to: "expired" | "failed" | "cancelled"; reason: string; requestId: string },
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
  if (input.from === "accepted" && tour.roomId) await videoRoomProvider().deleteRoom(tour.roomId);
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
export async function endTour(input: { tourId: string; eventId: string; outcome: "ended" | "failed"; durationSeconds?: number; requestId: string; keepRoom?: boolean }) {
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
  // H18.7: paid on connect -> the call is still running, so the room stays (it expires by itself).
  if (claim.roomId && !input.keepRoom) await videoRoomProvider().deleteRoom(claim.roomId);
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
  const stale = await VideoTour.find({ $or: staleFilters(now) }).limit(200).lean();
  let expired = 0;
  for (const tour of stale) {
    if (await closeStaleTour(tour, requestId)) expired += 1;
  }
  return { toursClosed: expired };
}

/** The two ways an open tour has run out of time: nobody accepted it, or it was accepted and nobody connected. */
function staleFilters(now: number) {
  return [
    { status: "requested" as const, requestedAt: { $lt: new Date(now - TOUR_ACCEPT_WINDOW_MS) } },
    { status: "accepted" as const, acceptedAt: { $lt: new Date(now - TOUR_CALL_TIMEOUT_MS) } },
  ];
}

function closeStaleTour(tour: VideoTourDoc & { _id?: unknown }, requestId: string) {
  const isRequest = tour.status === "requested";
  return closeTour(tour, {
    from: isRequest ? "requested" : "accepted",
    to: isRequest ? "expired" : "failed",
    reason: isRequest ? "not-accepted" : "call-not-ended",
    requestId,
  });
}

/**
 * The same refund as the cron job, done when a person's own screen asks for their tours. The refund no longer waits for the
 * nightly run, so a request nobody answered in 30 minutes is back in the wallet the next time either person looks.
 */
async function closeStaleFor(userId: string) {
  const stale = await VideoTour.find({ $and: [{ $or: [{ userId }, { ownerId: userId }] }, { $or: staleFilters(Date.now()) }] })
    .limit(20)
    .lean();
  for (const tour of stale) await closeStaleTour(tour, "poll").catch((error) => console.error("video tour could not be closed", error));
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
        { account: "vendor_earnings", ownerKey: String(claim.ownerId), delta: -splitCall(claim.coins, claim.feePercent ?? 0).vendor },
        ...(splitCall(claim.coins, claim.feePercent ?? 0).fee > 0 ? [{ account: "platform_revenue" as const, ownerKey: "system", delta: -splitCall(claim.coins, claim.feePercent ?? 0).fee }] : []),
        { account: "call_wallet", ownerKey: String(claim.userId), delta: claim.coins },
      ],
      requestId: input.requestId,
      actorId: input.actorId,
      actorType: "admin",
    });
  } catch (error) {
    await VideoTour.updateOne({ _id: id, status: "reversing" }, { $set: { status: "disputed" } });
    if (error instanceof PaymentRequiredError) {
      throw new ConflictError("The advertiser has already withdrawn these credits; handle it by hand");
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
  // A request nobody answered in 30 minutes (or a call nobody joined) is refunded as soon as either person looks.
  await closeStaleFor(userId).catch((error) => console.error("video tours could not be refreshed", error));
  const rows = await VideoTour.find({ $or: [{ userId }, { ownerId: userId }] })
    .sort({ requestedAt: -1 })
    .limit(50)
    .lean();
  // H19.5: each call shows which ad it is about (photo and title) and the other person's name.
  const ads = await Listing.find({ _id: { $in: [...new Set(rows.map((row) => String(row.listingId)))] } })
    .select("title slug coverMediaId mediaIds")
    .lean<{ _id: unknown; title?: string; slug?: string; coverMediaId?: unknown; mediaIds?: unknown[] }[]>();
  const adById = new Map(ads.map((ad) => [String(ad._id), ad]));
  const coverIds = ads.map((ad) => ad.coverMediaId ?? ad.mediaIds?.[0]).filter(Boolean) as mongoose.Types.ObjectId[];
  const assets = coverIds.length ? await MediaAsset.find({ _id: { $in: coverIds }, kind: "image" }).select("objectKey").lean<{ _id: unknown; objectKey: string }[]>() : [];
  const photoById = new Map(assets.map((asset) => [String(asset._id), adPhotoUrl(asset.objectKey)]));
  const people = await User.find({ _id: { $in: [...new Set(rows.flatMap((row) => [String(row.userId), String(row.ownerId)]))] } })
    .select("displayName email sellerProfile.name")
    .lean<{ _id: unknown; displayName?: string; email?: string; sellerProfile?: { name?: string } | null }[]>();
  // The seller's profile name, else the display name, else the part of the email before the @ (as in the call room). Never the full email or phone.
  const nameById = new Map(people.map((person) => [String(person._id), (person.sellerProfile?.name || "").trim() || accountName(person.displayName, person.email || "")] as const));
  const busyOf = new Map<string, boolean>();
  const out = [];
  for (const row of rows) {
    const isAdvertiser = String(row.ownerId) === userId;
    const open = row.status === "requested" || row.status === "accepted";
    const ad = adById.get(String(row.listingId));
    const cover = ad ? ad.coverMediaId ?? ad.mediaIds?.[0] : undefined;
    const otherName = nameById.get(String(isAdvertiser ? row.userId : row.ownerId)) ?? "Member";
    const joinUrl = row.roomId && row.status === "accepted" && videoRoomProvider().name === "daily" ? callPagePath(String(row._id)) : null;
    // The line: how many still-open requests for the same advertiser came in before this one. Only the buyer's screen shows it.
    const ahead =
      !isAdvertiser && row.status === "requested"
        ? await VideoTour.countDocuments({
            ownerId: row.ownerId,
            status: "requested",
            requestedAt: { $lt: row.requestedAt, $gte: new Date(Date.now() - TOUR_ACCEPT_WINDOW_MS) },
          })
        : null;
    // Is the advertiser on another call right now (their Accept button is off, and the buyer is told they are in the line).
    const ownerKey = String(row.ownerId);
    if (open && !busyOf.has(ownerKey)) busyOf.set(ownerKey, await vendorInCall(ownerKey).catch(() => false));
    // H19.10: only the vendor sees what they earn; the user sees the price and nothing of the split.
    const split = splitCall(row.coins, row.feePercent ?? 0);
    out.push({
      ...present(row),
      adTitle: ad?.title ?? null,
      adSlug: ad?.slug ?? null,
      adPhoto: cover ? photoById.get(String(cover)) ?? null : null,
      otherName,
      role: isAdvertiser ? "advertiser" : "buyer",
      joinUrl,
      ahead,
      busy: open && busyOf.get(ownerKey) === true,
      ...(isAdvertiser ? { youEarn: split.vendor, tharkooFee: split.fee } : {}),
    });
  }
  return out;
}

const ANSWERED = ["accepted", "ending", "completed", "disputed", "reversing", "reversed"];

/**
 * Counts for the video calls page, straight from the database (never estimated). Each side counts its own calls:
 * as the advertiser (requests that came in) and as the buyer (requests this person made).
 */
export async function tourStats(userId: string) {
  await connectDb();
  const id = objectId(userId, "userId");
  const groups = await VideoTour.aggregate<{ _id: { role: "advertiser" | "buyer"; status: string }; n: number }>([
    { $match: { $or: [{ userId: id }, { ownerId: id }] } },
    { $group: { _id: { role: { $cond: [{ $eq: ["$ownerId", id] }, "advertiser", "buyer"] }, status: "$status" }, n: { $sum: 1 } } },
  ]);
  const side = (role: "advertiser" | "buyer") => {
    const rows = groups.filter((group) => group._id.role === role);
    const count = (...statuses: string[]) => rows.filter((group) => statuses.includes(group._id.status)).reduce((sum, group) => sum + group.n, 0);
    return {
      total: rows.reduce((sum, group) => sum + group.n, 0),
      waiting: count("requested"),
      accepted: count(...ANSWERED),
      declined: count("declined"),
      missed: count("expired", "cancelled"),
      completed: count("completed", "disputed", "reversing", "reversed"),
    };
  };
  return { advertiser: side("advertiser"), buyer: side("buyer") };
}

/** The call page for one side of an accepted tour: who they are, and a fresh link into the room. */
export async function tourCallFor(input: { userId: string; tourId: string }) {
  await connectDb();
  const tour = await VideoTour.findById(objectId(input.tourId, "tourId")).lean();
  const isAdvertiser = tour ? String(tour.ownerId) === input.userId : false;
  const isBuyer = tour ? String(tour.userId) === input.userId : false;
  if (!tour || (!isAdvertiser && !isBuyer)) throw new NotFoundError("Not found");
  const listing = await Listing.findById(tour.listingId).select("slug title").lean();
  const report = listing?.slug || String(tour.listingId);
  const base = { id: String(tour._id), status: tour.status, role: isAdvertiser ? ("advertiser" as const) : ("buyer" as const), title: listing?.title || "", report };
  const expiresAt = tour.acceptedAt ? roomExpiry(new Date(tour.acceptedAt)) : null;
  if (tour.status !== "accepted" || !tour.roomId || !expiresAt || expiresAt.getTime() <= Date.now()) return { ...base, joinUrl: null };
  const user = await User.findById(input.userId).select("displayName email").lean();
  const joinUrl = await videoRoomProvider().joinUrlFor({
    roomId: tour.roomId,
    side: base.role,
    userName: accountName(user?.displayName, user?.email || ""),
    expiresAt,
  });
  return { ...base, joinUrl };
}

export async function listVideoTourCategories() {
  await connectDb();
  // H19.10: opening the screen raises any category under the lowest price (once; logged).
  await raiseLowCallPrices("video-tours-screen");
  const rows = await Category.find({}).select("name slug kind fields videoTourEnabled videoTourCoins").sort({ order: 1 }).lean();
  const allowing = new Set((await listKinds()).filter((kind) => kind.videoTours).map((kind) => kind.key));
  return rows.map((row) => ({
    kindVideoOff: !allowing.has(row.kind ?? ""),
    peopleLocked: isPeopleListing(row as { slug?: string; kind?: string; fields?: unknown }),
    id: String(row._id),
    name: row.name,
    slug: row.slug,
    kind: row.kind ?? null,
    videoTourEnabled: row.videoTourEnabled === true,
    videoTourCoins: Math.max(row.videoTourCoins ?? 1, TOUR_MIN_PRICE_COINS),
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
  const kind: CategoryKind = await requireKind(input.kind ?? category.kind ?? "goods").catch(() => {
    throw new ValidationError("Invalid request", { kind: ["Unknown kind"] });
  });
  const people = isPeopleListing({ slug: category.slug, kind, fields: category.fields });
  if (people && input.enabled === true) {
    throw new ValidationError("Invalid request", { enabled: [VIDEO_NEVER_FOR_PEOPLE] });
  }
  if (input.enabled === true && !(await kindAllowsVideo({ slug: category.slug, kind, fields: category.fields }))) {
    throw new ValidationError("Invalid request", { enabled: ["This kind does not allow live video tours. Change it under Categories & fields, Kinds."] });
  }
  const enabled = people ? false : (input.enabled ?? category.videoTourEnabled === true);
  if (input.coins !== undefined && input.coins < TOUR_MIN_PRICE_COINS) throw new ValidationError("Invalid request", { coins: [`The lowest price of a video call is ${TOUR_MIN_PRICE_COINS} credits.`] });
  // A category still on an older, lower price is raised to the lowest price when its settings are saved.
  const coins = input.coins ?? Math.max(category.videoTourCoins ?? TOUR_MIN_PRICE_COINS, TOUR_MIN_PRICE_COINS);
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

/**
 * H18.7: pays every accepted call where both people are in the room right now (asked from the video service, not
 * from the phones, so nobody can fake it). Run every minute by the server cron. A call nobody joins is refunded later
 * by expireDueTours.
 */
export async function settleConnectedTours(requestId: string) {
  await connectDb();
  const tours = await VideoTour.find({ status: "accepted", roomId: { $nin: ["", null] } }).select("_id roomId").limit(200).lean<{ _id: unknown; roomId?: string }[]>();
  let paid = 0;
  for (const tour of tours) {
    const count = await videoRoomProvider().participantCount(String(tour.roomId)).catch(() => 0);
    if (count < 2) continue;
    const id = String(tour._id);
    await endTour({ tourId: id, eventId: `connected:${id}`, outcome: "ended", durationSeconds: 0, requestId, keepRoom: true }).catch(() => undefined);
    paid += 1;
  }
  return { checked: tours.length, paid };
}
