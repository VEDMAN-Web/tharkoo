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
  subcategoryId: idSchema.optional(),
  title: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(5000).optional(),
  stateId: idSchema.optional(),
  cityId: idSchema.optional(),
  districtId: idSchema.optional(),
  localityId: idSchema.optional(),
});

export const listingPatchBodySchema = z.discriminatedUnion("stage", [
  z.object({
    stage: z.literal("basics"),
    categoryId: idSchema.optional(),
    subcategoryId: idSchema.optional(),
    title: z.string().trim().min(1).max(140).optional(),
    description: z.string().trim().max(5000).optional(),
    stateId: idSchema.optional(),
    cityId: idSchema.optional(),
    districtId: idSchema.optional(),
    localityId: idSchema.optional(),
  }),
  z.object({
    stage: z.literal("details"),
    attributes: z.record(z.string(), z.unknown()).optional(),
    /** H7.5: the New design price field. Whole rupees, or null to clear. The service checks the number. */
    price: z.union([z.number(), z.string().max(20)]).nullable().optional(),
    nickname: z.string().trim().max(40).optional(),
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
  /** H7.5: the vendor panel tabs. Live, In review and Ended; All is no group. */
  group: z.enum(["live", "review", "ended"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const contactRevealBodySchema = z.object({
  channel: z.enum(["phone", "whatsapp", "telegram", "form"]),
});

export const mediaSignBodySchema = z.object({
  listingId: idSchema.optional(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"]),
  byteSize: z.number().int().positive().max(100 * 1024 * 1024),
  kind: z.enum(["image", "video", "id_document"]),
}).superRefine((body, context) => {
  const isVideoType = body.contentType.startsWith("video/");
  if (body.kind === "video" && !isVideoType) context.addIssue({ code: "custom", path: ["contentType"], message: "Use an mp4, webm or mov video." });
  if (body.kind !== "video" && isVideoType) context.addIssue({ code: "custom", path: ["contentType"], message: "Use a JPG, PNG or WebP photo." });
  if (body.kind !== "video" && body.byteSize > 8 * 1024 * 1024) context.addIssue({ code: "custom", path: ["byteSize"], message: "This photo is too big (max 8 MB)." });
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

export const verificationCompleteBodySchema = z
  .object({
    frontAssetId: idSchema,
    backAssetId: idSchema.optional(),
    selfieAssetId: idSchema,
  })
  .refine((body) => body.frontAssetId !== body.selfieAssetId, {
    path: ["selfieAssetId"],
    message: "Selfie must be a different upload from the front of the ID",
  });

export const verificationDecisionBodySchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().min(1).max(500),
});
