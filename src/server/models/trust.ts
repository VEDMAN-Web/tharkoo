import { Schema, type Types } from "mongoose";
import { appendOnlyPlugin, lockBulkWrites } from "@/server/audit/append-only";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";

export type ReportReason =
  | "prohibited_content"
  | "trafficking_concern"
  | "stolen_media"
  | "spam"
  | "fake"
  | "duplicate"
  | "wrong_contact"
  | "other";

export type Severity = "S0" | "S1" | "S2" | "S3";

export interface ReportDoc {
  _id?: Types.ObjectId;
  listingId: Types.ObjectId;
  reporterUserId?: Types.ObjectId;
  reporterIpHash?: string;
  reason: ReportReason;
  details?: string;
  severity: Severity;
  status: "open" | "ack" | "actioned" | "dismissed";
  slaAckDueAt?: Date;
  slaDecisionDueAt?: Date;
  assigneeId?: Types.ObjectId;
  note?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ModerationCaseType =
  | "prepublish"
  | "sensitive_edit"
  | "auto_classifier"
  | "csam"
  | "trafficking"
  | "report_escalation";

export interface ModerationCaseDoc {
  _id?: Types.ObjectId;
  type: ModerationCaseType;
  listingId?: Types.ObjectId;
  userId?: Types.ObjectId;
  mediaId?: Types.ObjectId;
  severity: Severity;
  status: "open" | "in_progress" | "closed";
  flags?: string[];
  decision?: string;
  mandatoryReportStatus?: "required" | "filed" | "n/a";
  closedAt?: Date;
  createdAt?: Date;
}

export interface AuditEventDoc {
  _id?: Types.ObjectId;
  actorId?: Types.ObjectId | null;
  actorType: "user" | "admin" | "worker" | "system";
  action: string;
  targetType: string;
  targetId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  requestId: string;
  ipHash?: string;
  createdAt?: Date;
}

const reportSchema = new Schema<ReportDoc>(
  {
    listingId: { type: Schema.Types.ObjectId, required: true },
    reporterUserId: { type: Schema.Types.ObjectId },
    reporterIpHash: { type: String },
    reason: {
      type: String,
      enum: [
        "prohibited_content",
        "trafficking_concern",
        "stolen_media",
        "spam",
        "fake",
        "duplicate",
        "wrong_contact",
        "other",
      ],
      required: true,
    },
    details: { type: String, default: "" },
    severity: { type: String, enum: ["S0", "S1", "S2", "S3"], required: true },
    status: { type: String, enum: ["open", "ack", "actioned", "dismissed"], default: "open" },
    slaAckDueAt: { type: Date },
    slaDecisionDueAt: { type: Date },
    assigneeId: { type: Schema.Types.ObjectId },
    note: { type: String },
  },
  { timestamps: true, collection: collectionName("reports", "Report") },
);
reportSchema.index({ status: 1, severity: 1, createdAt: 1 });

const moderationCaseSchema = new Schema<ModerationCaseDoc>(
  {
    type: {
      type: String,
      enum: [
        "prepublish",
        "sensitive_edit",
        "auto_classifier",
        "csam",
        "trafficking",
        "report_escalation",
      ],
      required: true,
    },
    listingId: { type: Schema.Types.ObjectId },
    userId: { type: Schema.Types.ObjectId },
    mediaId: { type: Schema.Types.ObjectId },
    severity: { type: String, enum: ["S0", "S1", "S2", "S3"], required: true },
    status: { type: String, enum: ["open", "in_progress", "closed"], default: "open" },
    flags: { type: [String], default: [] },
    decision: { type: String },
    mandatoryReportStatus: { type: String, enum: ["required", "filed", "n/a"] },
    closedAt: { type: Date },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: collectionName("moderation_cases", "ModerationCase"),
  },
);
moderationCaseSchema.index({ status: 1, type: 1, severity: 1 });

const auditCollection = collectionName("audit_events", "AuditEvent");
const auditEventSchema = new Schema<AuditEventDoc>(
  {
    actorId: { type: Schema.Types.ObjectId, default: null },
    actorType: { type: String, enum: ["user", "admin", "worker", "system"], required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    reason: { type: String },
    requestId: { type: String, required: true },
    ipHash: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: auditCollection },
);
auditEventSchema.index({ actorId: 1, createdAt: -1 });
auditEventSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditEventSchema.index({ action: 1, createdAt: -1 });
appendOnlyPlugin(auditEventSchema, auditCollection);

export const Report = registerModel<ReportDoc>(modelName("Report"), reportSchema);
export const ModerationCase = registerModel<ModerationCaseDoc>(
  modelName("ModerationCase"),
  moderationCaseSchema,
);
export const AuditEvent = registerModel<AuditEventDoc>(modelName("AuditEvent"), auditEventSchema);

lockBulkWrites(AuditEvent, auditCollection);
