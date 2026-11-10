import { z } from "zod";
import { idSchema } from "@/server/shared/schemas/common";

const contactSchema = z.object({
  phone: z.string().trim().max(32).optional(),
  whatsapp: z.string().trim().max(32).optional(),
  telegram: z.string().trim().max(64).optional(),
  acceptForm: z.boolean().optional(),
});

export const listingCreateBodySchema = z.object({
  categoryId: idSchema,
  title: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().min(1).max(5000).optional(),
  stateId: idSchema.optional(),
  cityId: idSchema.optional(),
  districtId: idSchema.optional(),
  localityId: idSchema.optional(),
});

export const listingPatchBodySchema = z.discriminatedUnion("stage", [
  z.object({
    stage: z.literal("basics"),
    categoryId: idSchema.optional(),
    title: z.string().trim().min(1).max(140).optional(),
    description: z.string().trim().min(1).max(5000).optional(),
    stateId: idSchema.optional(),
    cityId: idSchema.optional(),
    districtId: idSchema.optional(),
    localityId: idSchema.optional(),
  }),
  z.object({
    stage: z.literal("details"),
    attributes: z.record(z.string(), z.unknown()).optional(),
    contact: contactSchema.optional(),
  }),
  z.object({
    stage: z.literal("photos"),
    mediaIds: z.array(idSchema).max(10),
    coverMediaId: idSchema.optional(),
  }),
]);

export const listingSubmitBodySchema = z.object({
  attestations: z.object({
    adult: z.literal(true),
    accurate: z.literal(true),
    rights: z.literal(true),
  }),
});

export const listingQuerySchema = z.object({
  status: z
    .enum(["draft", "pending", "active", "rejected", "paused", "expired", "archived", "removed", "deleted"])
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const contactRevealBodySchema = z.object({
  channel: z.enum(["phone", "whatsapp", "telegram", "form"]),
});

export const mediaSignBodySchema = z.object({
  listingId: idSchema.optional(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  byteSize: z.number().int().positive().max(8 * 1024 * 1024),
  kind: z.enum(["image", "video", "id_document"]),
});

export const mediaCompleteBodySchema = z.object({
  mediaId: idSchema,
});

export const mediaReorderBodySchema = z.object({
  listingId: idSchema,
  orderedMediaIds: z.array(idSchema).max(10),
  coverId: idSchema.optional(),
});

export const verificationUploadBodySchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  byteSize: z.number().int().positive().max(8 * 1024 * 1024),
});

const verificationDocumentsBodySchema = z.object({
  frontAssetId: idSchema,
  backAssetId: idSchema.optional(),
  selfieAssetId: idSchema,
});

/** New rows send front, optional back, and selfie. `{ assetId }` still parses so the current complete handler keeps typechecking until it reads the new fields. */
export const verificationCompleteBodySchema = z
  .union([verificationDocumentsBodySchema, z.object({ assetId: idSchema })])
  .transform((body) => {
    if ("frontAssetId" in body) {
      return { ...body, assetId: body.frontAssetId };
    }
    return { assetId: body.assetId, frontAssetId: body.assetId, selfieAssetId: body.assetId };
  });

export const verificationDecisionBodySchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().min(1).max(500),
});
