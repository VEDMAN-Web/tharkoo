import { z, type ZodType } from "zod";
import { attributeKeyDenied, textDenied } from "@/server/shared/policy";

export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "select",
  "multiselect",
  "boolean",
  "bool",
  "date",
  "range",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
  min?: number | null;
  max?: number | null;
  unit?: string;
  order: number;
  enabled: boolean;
  filterable?: boolean;
  shownOnCard?: boolean;
  placeholder?: string;
  help?: string;
  optionLabels?: Record<string, string>;
}

const keyPattern = /^[a-z][a-z0-9_]{0,40}$/;

export const fieldDefinitionSchema = z
  .object({
    key: z.string().regex(keyPattern),
    label: z.string().trim().min(1).max(80),
    type: z.enum(FIELD_TYPES),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
    min: z.number().nullable().optional(),
    max: z.number().nullable().optional(),
    unit: z.string().trim().max(20).optional().default(""),
    order: z.number().int().default(0),
    enabled: z.boolean().default(true),
    filterable: z.boolean().optional().default(true),
    shownOnCard: z.boolean().optional().default(false),
    placeholder: z.string().trim().max(120).optional().default(""),
    help: z.string().trim().max(200).optional().default(""),
    optionLabels: z.record(z.string(), z.string().trim().max(80)).optional(),
  })
  .superRefine((field, context) => {
    if (attributeKeyDenied(field.key).denied || textDenied(field.label).denied) {
      context.addIssue({ code: "custom", message: "Field is not allowed", path: ["key"] });
    }
    if ((field.type === "select" || field.type === "multiselect") && field.options.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Choose at least one option",
        path: ["options"],
      });
    }
    if (field.min != null && field.max != null && field.min > field.max) {
      context.addIssue({ code: "custom", message: "Min cannot exceed max", path: ["min"] });
    }
  });

export const fieldDefinitionListSchema = z
  .array(fieldDefinitionSchema)
  .max(40)
  .superRefine((fields, context) => {
    const seen = new Set<string>();
    fields.forEach((field, index) => {
      if (seen.has(field.key)) {
        context.addIssue({ code: "custom", message: "Duplicate field key", path: [index, "key"] });
      }
      seen.add(field.key);
    });
  });

function bounds(field: FieldDefinition) {
  let schema = z.number();
  if (field.min != null) schema = schema.min(field.min);
  if (field.max != null) schema = schema.max(field.max);
  return schema;
}

function fieldValueSchema(field: FieldDefinition): ZodType {
  switch (field.type) {
    case "text":
    case "textarea":
      return z
        .string()
        .trim()
        .min(1)
        .max(field.type === "textarea" ? 2000 : 500);
    case "number":
      return bounds(field);
    case "boolean":
    case "bool":
      return z.boolean();
    case "date":
      return z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    case "select":
      return z.string().refine((value) => field.options.includes(value), "Choose a listed option");
    case "multiselect":
      return z
        .array(z.string())
        .max(20)
        .refine(
          (values) => values.every((value) => field.options.includes(value)),
          "Choose listed options",
        );
    case "range":
      return z
        .object({ min: bounds(field), max: bounds(field) })
        .refine((value) => value.min <= value.max, "Range min cannot exceed max");
    default:
      return z.never();
  }
}

/** Build a strict Zod object from the enabled field definitions and parse listing attributes. */
export function parseListingAttributes(
  fields: FieldDefinition[],
  input: unknown,
): Record<string, unknown> {
  const enabled = [...fields]
    .filter((field) => field.enabled)
    .sort((left, right) => left.order - right.order);
  const shape: Record<string, ZodType> = {};
  for (const field of enabled) {
    const valueSchema = fieldValueSchema(field);
    shape[field.key] = field.required ? valueSchema : valueSchema.optional();
  }
  const record =
    input && typeof input === "object" && !Array.isArray(input)
      ? Object.fromEntries(
          Object.entries(input as Record<string, unknown>).filter(([, value]) => value !== null),
        )
      : input;
  return z
    .object(shape)
    .strict()
    .parse(record ?? {}) as Record<string, unknown>;
}
