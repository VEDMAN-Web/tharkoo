import { z } from "zod";
import { idSchema, pageQuerySchema } from "@/server/shared/schemas/common";

export const promotionCheckoutBodySchema = z.object({
  productId: idSchema,
  listingId: idSchema,
  durationDays: z.number().int().positive().max(365),
  idempotencyKey: z.string().trim().min(8).max(200),
  startsAt: z.string().datetime().optional(),
  autoRenew: z.boolean().optional(),
});

export const paymentWebhookBodySchema = z.object({
  eventId: z.string().trim().min(1).max(200),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["pending", "paid", "failed"]),
  amount: z.number().int().nonnegative().optional(),
  currency: z.string().trim().length(3).optional(),
  providerRef: z.string().trim().max(200).optional(),
});

export const refundBodySchema = z.object({
  paymentId: idSchema,
  amount: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500),
});

export const walletQuerySchema = pageQuerySchema;

export const walletPackBodySchema = z.object({
  packId: idSchema,
  idempotencyKey: z.string().trim().min(8).max(200),
  couponCode: z.string().trim().min(1).max(40).optional(),
});

export const couponRedeemBodySchema = z.object({
  code: z.string().trim().min(1).max(40),
});
