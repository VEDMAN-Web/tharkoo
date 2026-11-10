import { z } from "zod";
import { fieldDefinitionListSchema } from "@/server/shared/fields";
import { idSchema, pageQuerySchema } from "@/server/shared/schemas/common";

export const adminListingQuerySchema = pageQuerySchema.extend({
  status: z.string().trim().max(40).optional(),
  severity: z.enum(["S0", "S1", "S2", "S3"]).optional(),
  locationId: idSchema.optional(),
});

export const listingDecisionBodySchema = z.object({
  decision: z.enum(["approve", "reject", "request_changes", "pause", "remove"]),
  reason: z.string().trim().min(1).max(500),
  internalNote: z.string().trim().max(2000).optional(),
  templateId: idSchema.optional(),
});

export const categoryWriteBodySchema = z.object({
  slug: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  description: z.string().max(2000).optional(),
  parentId: idSchema.nullable().optional(),
  enabled: z.boolean().optional(),
  order: z.number().int().optional(),
  fields: fieldDefinitionListSchema.optional(),
});

export const locationWriteBodySchema = z.object({
  type: z.enum(["country", "state", "city", "district", "locality"]),
  slug: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  parentId: idSchema.nullable().optional(),
  enabled: z.boolean().optional(),
  order: z.number().int().optional(),
  countryCode: z.string().trim().length(2).optional(),
  oldSlugs: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
});

export const userSuspendBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const userReverifyBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const moderationDecisionBodySchema = z.object({
  decision: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(1).max(500),
  mandatoryReportStatus: z.enum(["required", "filed", "n/a"]).optional(),
});

export const auditQuerySchema = pageQuerySchema.extend({
  actorId: idSchema.optional(),
  action: z.string().trim().max(80).optional(),
  targetType: z.string().trim().max(80).optional(),
  targetId: z.string().trim().max(80).optional(),
});

export const featureFlagBodySchema = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().max(120).optional(),
  enabled: z.boolean(),
});

export const seoPageBodySchema = z.object({
  slug: z.string().trim().min(1).max(160),
  title: z.string().trim().max(180).optional(),
  description: z.string().trim().max(300).optional(),
  h1: z.string().trim().max(180).optional(),
  introHtml: z.string().max(8000).optional(),
  noindex: z.boolean().optional(),
});

export const seoTemplateBodySchema = z.object({
  pageType: z.string().trim().min(1).max(80),
  title: z.string().trim().max(180).optional(),
  description: z.string().trim().max(300).optional(),
  h1: z.string().trim().max(180).optional(),
  h2: z.string().trim().max(180).optional(),
  intro: z.string().max(8000).optional(),
  footer: z.string().max(2000).optional(),
});

export const productWriteBodySchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  amount: z.number().int().nonnegative(),
  currency: z.string().trim().length(3),
  durationDays: z.number().int().positive().max(365),
  enabled: z.boolean().optional(),
});

export const packWriteBodySchema = z.object({
  credits: z.number().int().positive(),
  price: z.number().int().nonnegative(),
  bonus: z.number().int().nonnegative().optional(),
  tag: z.string().trim().max(40).optional(),
  order: z.number().int().optional(),
  status: z.string().trim().max(40).optional(),
});

export const couponWriteBodySchema = z.object({
  code: z.string().trim().min(1).max(40),
  label: z.string().trim().max(80).optional(),
  value: z.string().trim().max(40).optional(),
  expiry: z.string().trim().max(40).optional(),
  status: z.string().trim().max(40).optional(),
  kind: z.enum(["percent", "credits", "label"]).optional(),
  percent: z.number().min(0).max(100).nullable().optional(),
  credits: z.number().int().nonnegative().nullable().optional(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
  perUserLimit: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const bannedWordBodySchema = z.object({
  text: z.string().trim().min(1).max(80),
  matchType: z.string().trim().max(40).optional(),
  scope: z.string().trim().max(40).optional(),
  action: z.string().trim().max(40).optional(),
});

export const adminListQuerySchema = z.object({
  collection: z.string().trim().min(1).max(80),
  page: z.coerce.number().int().positive().optional(),
});

export const adminMutateBodySchema = z.object({
  collection: z.string().trim().min(1).max(80),
  action: z.enum(["create", "update", "delete"]),
  id: idSchema.optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const analyticsEventBodySchema = z.object({
  name: z.enum([
    "search",
    "impression",
    "open",
    "gallery",
    "reveal",
    "save",
    "posting_step",
    "checkout",
    "report",
  ]),
  listingId: idSchema.optional(),
  props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const consentBodySchema = z.object({
  analytics: z.boolean(),
  necessary: z.literal(true),
});
