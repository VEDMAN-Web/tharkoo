import { z } from "zod";
import { dateOnlySchema, idSchema } from "@/server/shared/schemas/common";

export const registerBodySchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(80),
  dateOfBirth: dateOnlySchema,
  acceptedTerms: z.literal(true),
  attestedAdult: z.literal(true),
});

export const verifyEmailBodySchema = z.object({
  token: z.string().trim().min(16).max(256),
});

export const loginBodySchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
});

export const forgotPasswordBodySchema = z.object({
  email: z.email(),
});

export const resetPasswordBodySchema = z.object({
  token: z.string().trim().min(16).max(256),
  password: z.string().min(8).max(200),
});

export const phoneStartBodySchema = z.object({
  phone: z.string().trim().min(8).max(20),
});

export const phoneConfirmBodySchema = z.object({
  challengeId: idSchema,
  code: z.string().trim().min(4).max(12),
});
