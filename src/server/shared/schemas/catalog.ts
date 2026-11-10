import { z } from "zod";
import { idSchema } from "@/server/shared/schemas/common";

export const searchQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  area: z.string().trim().max(80).optional(),
  attributes: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]))
    .optional(),
  verified: z.boolean().optional(),
  badge: z.string().trim().max(40).optional(),
  sort: z.enum(["fresh", "ranked"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const locationQuerySchema = z.object({
  type: z.enum(["country", "state", "city", "district", "locality"]).optional(),
  parentId: idSchema.optional(),
  q: z.string().trim().max(80).optional(),
});

export const locationResolveQuerySchema = z.object({
  slugs: z.array(z.string().trim().min(1).max(80)).min(1).max(5),
});

export const savedMergeBodySchema = z.object({
  listingIds: z.array(idSchema).max(100),
});

export const recentViewBodySchema = z.object({
  listingId: idSchema,
});

export const reportCreateBodySchema = z.object({
  listingId: idSchema,
  reason: z.enum([
    "prohibited_content",
    "trafficking_concern",
    "stolen_media",
    "spam",
    "fake",
    "duplicate",
    "wrong_contact",
    "other",
  ]),
  details: z.string().trim().max(2000).optional(),
});

export const reportUpdateBodySchema = z.object({
  status: z.enum(["open", "ack", "actioned", "dismissed"]).optional(),
  assigneeId: idSchema.nullable().optional(),
  note: z.string().trim().max(2000).optional(),
});
