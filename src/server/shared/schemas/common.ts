import { z } from "zod";

export const idSchema = z.string().trim().min(1).max(64);

export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const cronBodySchema = z.object({}).strict();
