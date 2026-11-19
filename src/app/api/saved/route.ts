import type { Types } from "mongoose";
import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { requireUser } from "@/server/auth/service";
import { connectDb } from "@/lib/db";
import { Favourite, Listing, Location, MediaAsset } from "@/server/models";
import { previewUrlOf } from "@/server/media/mine";
import { handle, requestIdFrom, success, ValidationError } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function listingBySlug(slug: string) {
  await connectDb();
  return Listing.findOne({ slug, status: "active" }).select("_id slug title").lean();
}

async function dispatch(request: Request) {
  const requestId = requestIdFrom(request);
  const user = await requireUser(readCookie(request, SESSION_COOKIE));
  if (request.method === "GET") {
    await connectDb();
    const rows = await Favourite.find({ userId: user.user.id }).sort({ createdAt: -1 }).limit(100).lean();
    const listings = (await Listing.find({ _id: { $in: rows.map((row) => row.listingId) }, status: "active" })
      .select("slug title cityId coverMediaId mediaIds")
      .lean()) as { _id: unknown; slug?: string; title?: string; cityId?: unknown; coverMediaId?: unknown; mediaIds?: unknown[] }[];
    // H15.7: the account's own list, with what a saved card shows (photo and place), newest first, the same on every device.
    const coverIds = listings.map((row) => row.coverMediaId ?? row.mediaIds?.[0]).filter(Boolean) as Types.ObjectId[];
    const assets = coverIds.length ? await MediaAsset.find({ _id: { $in: coverIds }, kind: "image" }).select("kind objectKey").lean() : [];
    const photos = new Map(assets.map((asset) => [String(asset._id), previewUrlOf(asset).url] as const));
    const cityIds = listings.map((row) => row.cityId).filter(Boolean) as Types.ObjectId[];
    const cities = cityIds.length ? await Location.find({ _id: { $in: cityIds } }).select("name").lean() : [];
    const cityNames = new Map(cities.map((city) => [String(city._id), String((city as { name?: string }).name ?? "")] as const));
    const byId = new Map(listings.map((row) => [String(row._id), row] as const));
    const items = rows.flatMap((row) => {
      const listing = byId.get(String(row.listingId));
      if (!listing?.slug) return [];
      const cover = listing.coverMediaId ?? listing.mediaIds?.[0];
      return [{
        slug: listing.slug,
        title: listing.title ?? "",
        place: listing.cityId ? cityNames.get(String(listing.cityId)) ?? "" : "",
        photo: cover ? photos.get(String(cover)) ?? null : null,
        at: new Date(row.createdAt as unknown as string | Date).getTime() || 0,
      }];
    });
    return Response.json(success({ items }, requestId));
  }
  assertOrigin(request);
  const body = (await request.json().catch(() => null)) as { slug?: string } | null;
  const slug = body?.slug?.trim() || "";
  if (!slug || slug.length > 160) throw new ValidationError("Invalid request", { slug: ["Required"] });
  const listing = await listingBySlug(slug);
  if (!listing?._id) throw new ValidationError("Invalid request", { slug: ["Unknown ad"] });
  if (request.method === "POST") {
    await Favourite.updateOne(
      { userId: user.user.id, listingId: listing._id },
      { $setOnInsert: { userId: user.user.id, listingId: listing._id } },
      { upsert: true },
    );
    return Response.json(success({ saved: true, slug }, requestId));
  }
  if (request.method === "DELETE") {
    await Favourite.deleteOne({ userId: user.user.id, listingId: listing._id });
    return Response.json(success({ saved: false, slug }, requestId));
  }
  throw new ValidationError("Invalid request", { method: ["Use GET, POST, or DELETE"] });
}

export const GET = handle(dispatch);
export const POST = handle(dispatch);
export const DELETE = handle(dispatch);
