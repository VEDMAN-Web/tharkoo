import { Schema, type Types } from "mongoose";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";

export const MAX_AUDIT_ROWS = 5000;

export interface SeoAuditRowDoc {
  path: string;
  agent: string;
  status: number;
  inSitemap: boolean;
  title: string;
  p0: string[];
  p1: string[];
}

export interface SeoAuditRunDoc {
  _id?: Types.ObjectId;
  startedAt: Date;
  finishedAt?: Date | null;
  base: string;
  counts: { urls: number; requests: number; p0Rows: number; p1Rows: number; robotsIssues: number };
  robotsIssues: string[];
  rows: SeoAuditRowDoc[];
  triggeredBy: string;
  createdAt?: Date;
}

const seoAuditRunSchema = new Schema<SeoAuditRunDoc>(
  {
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },
    base: { type: String, required: true },
    counts: { type: Schema.Types.Mixed, default: {} },
    robotsIssues: { type: [String], default: [] },
    rows: { type: Schema.Types.Mixed, default: [] },
    triggeredBy: { type: String, default: "cron" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: collectionName("seo_audit_runs", "SeoAuditRun") },
);
seoAuditRunSchema.index({ startedAt: -1 });

export const SeoAuditRun = registerModel<SeoAuditRunDoc>(modelName("SeoAuditRun"), seoAuditRunSchema);
