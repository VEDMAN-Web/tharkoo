import type { Model } from "mongoose";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { NotFoundError, ValidationError } from "@/server/http";
import { Category, Location, SiteMedia } from "@/server/models";
import type { CatalogBandDoc, CatalogPhotoDoc } from "@/server/models/catalog";

export const PICTURE_ALT_MAX = 125;
const ALT_MIN = 3;

export type CatalogModelName = "Category" | "Location";
type Doc = Record<string, unknown>;

export type PictureImage = { assetId: string; src: string; alt: string; width: number; height: number };
export type PhotoView = { image: PictureImage; focusX: number; focusY: number };
export type BandView = { image: PictureImage; phone: PictureImage | null; focusX: number; focusY: number };
export type PicturesView = { photo: PhotoView | null; band: BandView | null };

export type PictureInput = {
  photo: { assetId: string; alt: string; focusX: number; focusY: number } | null;
  band: { assetId: string; phoneAssetId: string | null; alt: string; focusX: number; focusY: number } | null;
};

type MediaRow = { _id: Types.ObjectId; url: string; alt: string; width: number; height: number; trashedAt?: Date | null };

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function modelOf(name: CatalogModelName): Model<Doc> {
  return (name === "Category" ? Category : Location) as unknown as Model<Doc>;
}

function focus(value: unknown, label: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) throw new ValidationError(`${label} must be between 0 and 100`);
  return Math.round(number);
}

function alt(value: unknown, label: string): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length < ALT_MIN) throw new ValidationError(`Describe the ${label} picture in a few words (picture description)`);
  if (text.length > PICTURE_ALT_MAX) throw new ValidationError(`The ${label} picture description can be at most ${PICTURE_ALT_MAX} characters`);
  return text;
}

async function mediaId(value: string, label: string): Promise<Types.ObjectId> {
  if (!Types.ObjectId.isValid(value)) throw new ValidationError(`Choose the ${label} picture from the media library`);
  const row = await SiteMedia.findById(value).select("trashedAt").lean<{ trashedAt?: Date | null } | null>();
  if (!row || row.trashedAt) throw new ValidationError(`The ${label} picture is no longer in the media library. Choose another.`);
  return new Types.ObjectId(value);
}

async function cleaned(input: PictureInput): Promise<{ photo?: CatalogPhotoDoc; band?: CatalogBandDoc }> {
  const out: { photo?: CatalogPhotoDoc; band?: CatalogBandDoc } = {};
  if (input.photo) {
    out.photo = {
      mediaId: await mediaId(input.photo.assetId, "photo"),
      focusX: focus(input.photo.focusX, "The photo focus point"),
      focusY: focus(input.photo.focusY, "The photo focus point"),
      alt: alt(input.photo.alt, "photo"),
    };
  }
  if (input.band) {
    out.band = {
      mediaId: await mediaId(input.band.assetId, "band"),
      focusX: focus(input.band.focusX, "The band focus point"),
      focusY: focus(input.band.focusY, "The band focus point"),
      alt: alt(input.band.alt, "band"),
      ...(input.band.phoneAssetId ? { phoneMediaId: await mediaId(input.band.phoneAssetId, "band phone") } : {}),
    };
  }
  return out;
}

function pick(doc: Doc | null): Doc {
  return Object.fromEntries((["photo", "band"] as const).filter((key) => doc && doc[key] !== undefined && doc[key] !== null).map((key) => [key, (doc as Doc)[key]]));
}

/**
 * Sets or clears the photo and the band of one category or place (H8.39). The pictures come from the media library
 * (SiteMedia) by id, so the library's usage registry knows about them. One audited write; undo puts the old pictures back.
 */
export async function setCatalogPictures(ctx: AdminCtx, model: CatalogModelName, id: string, input: PictureInput): Promise<{ name: string; eventId: string; undoUntil: string | null }> {
  await connectDb();
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Not found");
  const Source = modelOf(model);
  const existing = plain(await Source.findById(id).lean<Doc | null>());
  if (!existing) throw new NotFoundError("Not found");
  const label = String(existing.name ?? existing.slug ?? model);
  const next = await cleaned(input);
  const written = await adminWrite<{ name: string }>(ctx, {
    perm: "catalogue.edit",
    action: `${model.toLowerCase()}.pictures`,
    target: { type: model, id, label },
    texts: [next.photo?.alt, next.band?.alt],
    undo: { kind: "record.restore", windowKey: "edits" },
    before: async () => pick(existing),
    apply: async () => {
      const update: Doc = {};
      const unset: Doc = {};
      for (const key of ["photo", "band"] as const) {
        if (next[key]) update[key] = next[key];
        else unset[key] = "";
      }
      await Source.updateOne({ _id: id }, { ...(Object.keys(update).length ? { $set: update } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) });
      const now = plain(await Source.findById(id).lean<Doc | null>());
      return {
        after: pick(now),
        result: { name: label },
        summary: `Changed the pictures of ${label}`,
        undoData: {
          model,
          id,
          restore: pick(existing),
          unset: (["photo", "band"] as const).filter((key) => existing[key] === undefined || existing[key] === null),
          expect: pick(now),
        },
      };
    },
  });
  await refreshPublicCache();
  return { name: written.result.name, eventId: written.eventId, undoUntil: written.undoUntil };
}

async function imagesFor(ids: Types.ObjectId[]): Promise<Map<string, PictureImage>> {
  if (ids.length === 0) return new Map();
  const rows = await SiteMedia.find({ _id: { $in: ids } }).select("url alt width height").lean<MediaRow[]>();
  return new Map(rows.map((row) => [String(row._id), { assetId: String(row._id), src: row.url, alt: row.alt, width: row.width, height: row.height }]));
}

type Slots = { photo?: CatalogPhotoDoc & { alt?: string }; band?: (CatalogBandDoc & { alt?: string }) | undefined };

/** The pictures of many categories or places, with the library image behind each (url, size, description). */
export async function picturesOf(docs: Slots[]): Promise<PicturesView[]> {
  await connectDb();
  const ids = docs.flatMap((doc) => [doc.photo?.mediaId, doc.band?.mediaId, doc.band?.phoneMediaId].filter((value): value is Types.ObjectId => Boolean(value)));
  const images = await imagesFor(ids);
  return docs.map((doc) => {
    const photoImage = doc.photo?.mediaId ? images.get(String(doc.photo.mediaId)) : undefined;
    const bandImage = doc.band?.mediaId ? images.get(String(doc.band.mediaId)) : undefined;
    const phone = doc.band?.phoneMediaId ? images.get(String(doc.band.phoneMediaId)) ?? null : null;
    return {
      photo: doc.photo && photoImage ? { image: { ...photoImage, alt: doc.photo.alt || photoImage.alt }, focusX: doc.photo.focusX ?? 50, focusY: doc.photo.focusY ?? 50 } : null,
      band: doc.band && bandImage ? { image: { ...bandImage, alt: doc.band.alt || bandImage.alt }, phone, focusX: doc.band.focusX ?? 50, focusY: doc.band.focusY ?? 50 } : null,
    };
  });
}
