import { SESSION_COOKIE, assertOrigin, readCookie } from "@/server/auth/http";
import { requireUser } from "@/server/auth/service";
import { connectDb } from "@/lib/db";
import { Favourite, Listing } from "@/server/models";
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
    const listings = await Listing.find({ _id: { $in: rows.map((row) => row.listingId) }, status: "active" })
      .select("slug title")
      .lean();
    return Response.json(success({ items: listings.map((row) => ({ slug: row.slug, title: row.title })) }, requestId));
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
