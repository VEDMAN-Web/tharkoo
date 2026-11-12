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
  desc?: string;
  h1?: string;
  canonical?: string;
  words?: number;
  ld?: string[];
  noindex?: boolean;
  p0: string[];
  p1: string[];
}

export interface SeoAuditRunDoc {
  _id?: Types.ObjectId;
  startedAt: Date;
  finishedAt?: Date | null;
  base: string;
  counts: { urls: number; sitemapUrls?: number; requests: number; p0Rows: number; p1Rows: number; robotsIssues: number };
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

export const MAX_404_PATHS_PER_DAY = 2000;
const NOT_FOUND_KEEP_SECONDS = 60 * 24 * 3600;

export interface NotFoundDayDoc {
  _id?: Types.ObjectId;
  /** UTC day, YYYY-MM-DD. */
  day: string;
  path: string;
  hits: number;
  botHits: number;
  refDomain: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const notFoundDaySchema = new Schema<NotFoundDayDoc>(
  {
    day: { type: String, required: true },
    path: { type: String, required: true },
    hits: { type: Number, default: 0 },
    botHits: { type: Number, default: 0 },
    refDomain: { type: String, default: "" },
  },
  { timestamps: true, collection: collectionName("seo_not_found_days", "NotFoundDay") },
);
notFoundDaySchema.index({ day: 1, path: 1 }, { unique: true });
notFoundDaySchema.index({ createdAt: 1 }, { expireAfterSeconds: NOT_FOUND_KEEP_SECONDS });

export const NotFoundDay = registerModel<NotFoundDayDoc>(modelName("NotFoundDay"), notFoundDaySchema);
