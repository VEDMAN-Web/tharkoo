import { Schema, type Types } from "mongoose";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";
import type { ChosenVideo } from "@/server/import/videos";

export type ImportJobState = "uploading" | "importing" | "done";

export interface ImportJobRowResult {
  line: number;
  title: string;
  ok: boolean;
  errors: string[];
}

/** One partner import run (H6.12). Saved so that a closed page can be continued from the last saved row. */
export interface ImportJobDoc {
  _id?: Types.ObjectId;
  actorId: Types.ObjectId;
  partnerId: Types.ObjectId;
  partnerEmail: string;
  publishStatus: "pending" | "active";
  state: ImportJobState;
  csv: string;
  /** Every image name the staff member chose. */
  fileNames: string[];
  /** Names referenced by rows that can be imported. Only these are uploaded. */
  filesToUpload: string[];
  /** Photos already stored for this job: the chosen name and the media id it was stored as. */
  uploaded: Array<{ name: string; mediaId: string }>;
  /** Every video the staff member chose, with the size and length the browser read. Checked again at upload. */
  videoFiles: ChosenVideo[];
  /** Video names referenced by rows that can be imported. Only these are uploaded. */
  videosToUpload: string[];
  /** Videos already stored for this job. */
  uploadedVideos: Array<{ name: string; mediaId: string }>;
  total: number;
  nextRow: number;
  imported: number;
  failed: number;
  /** Videos attached to imported ads so far. */
  videos: number;
  rowResults: ImportJobRowResult[];
  /** Set while one request is working on the job, so two tabs do not import the same rows. */
  runningSince?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const rowResultSchema = new Schema<ImportJobRowResult>(
  {
    line: { type: Number, required: true },
    title: { type: String, default: "" },
    ok: { type: Boolean, required: true },
    errors: { type: [String], default: [] },
  },
  { _id: false },
);

const videoFileSchema = new Schema<ChosenVideo>(
  {
    name: { type: String, required: true },
    size: { type: Number, default: 0 },
    type: { type: String, default: "" },
    seconds: { type: Number, default: null },
  },
  { _id: false },
);

const importJobSchema = new Schema<ImportJobDoc>(
  {
    actorId: { type: Schema.Types.ObjectId, required: true, index: true },
    partnerId: { type: Schema.Types.ObjectId, required: true },
    partnerEmail: { type: String, required: true },
    publishStatus: { type: String, enum: ["pending", "active"], required: true },
    state: { type: String, enum: ["uploading", "importing", "done"], required: true },
    csv: { type: String, required: true },
    fileNames: { type: [String], default: [] },
    filesToUpload: { type: [String], default: [] },
    uploaded: { type: [{ name: String, mediaId: String }], default: [] },
    videoFiles: { type: [videoFileSchema], default: [] },
    videosToUpload: { type: [String], default: [] },
    uploadedVideos: { type: [{ name: String, mediaId: String }], default: [] },
    total: { type: Number, default: 0 },
    nextRow: { type: Number, default: 0 },
    imported: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    videos: { type: Number, default: 0 },
    rowResults: { type: [rowResultSchema], default: [] },
    runningSince: { type: Date, default: null },
  },
  { timestamps: true, collection: collectionName("import_jobs", "ImportJob") },
);

export const ImportJob = registerModel<ImportJobDoc>(modelName("ImportJob"), importJobSchema);
