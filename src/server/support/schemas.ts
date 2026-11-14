import { z } from "zod";
import {
  BODY_MAX,
  BODY_MIN,
  STATUS_LABELS,
  SUBJECT_MAX,
  SUBJECT_MIN,
  SUPPORT_STATUSES,
  SUPPORT_TOPICS,
} from "@/server/support/constants";
import { cleanSupportText } from "@/server/support/text";

/** Raw text is cleaned first, then length is checked, so a tag-only message counts as empty. */
function cleaned(max: number) {
  return z
    .string()
    .max(max * 4)
    .transform((value) => cleanSupportText(value, max));
}

const objectId = z.string().regex(/^[a-f0-9]{24}$/, "Choose a valid id");

export const ticketCreateSchema = z.object({
  topic: z.enum(SUPPORT_TOPICS, { message: "Choose a topic" }),
  subject: cleaned(SUBJECT_MAX).pipe(z.string().min(SUBJECT_MIN, `Write a subject of at least ${SUBJECT_MIN} characters`)),
  body: cleaned(BODY_MAX).pipe(z.string().min(BODY_MIN, `Describe the problem in at least ${BODY_MIN} characters`)),
});

/** A reply may be text, screenshots, or both. The service rejects an empty reply. */
export const replySchema = z.object({
  body: cleaned(BODY_MAX).optional().default(""),
  internal: z.boolean().optional().default(false),
});

const STAFF_SETTABLE = SUPPORT_STATUSES.filter((status) => status !== "closed");

export const statusSchema = z.object({
  status: z.enum(STAFF_SETTABLE, { message: `Choose one of: ${STAFF_SETTABLE.map((s) => STATUS_LABELS[s]).join(", ")}` }),
});

export const assignSchema = z.object({
  assigneeId: z.union([z.literal("me"), z.literal("none"), objectId]),
});

const queueStatus = z.enum(["active", ...SUPPORT_STATUSES]);

export const queueQuerySchema = z.object({
  status: queueStatus.optional().default("active"),
  topic: z.enum(SUPPORT_TOPICS).optional(),
  owner: z.enum(["user", "vendor"]).optional(),
  assigned: z.enum(["me"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
});

export type TicketCreateInput = z.infer<typeof ticketCreateSchema>;
export type ReplyInput = z.infer<typeof replySchema>;
export type QueueQuery = z.infer<typeof queueQuerySchema>;
