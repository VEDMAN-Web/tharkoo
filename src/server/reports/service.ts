import { createHash } from "node:crypto";
import { connectDb } from "@/lib/db";
import { ValidationError, NotFoundError } from "@/server/http";
import { Listing, Report } from "@/server/models";
import { VideoReport } from "@/server/reports/video-report";
import type { ReportReason, Severity } from "@/server/models/trust";

export type AdReportReason = ReportReason | "video";

export const REPORT_REASONS: readonly AdReportReason[] = [
  "prohibited_content",
  "trafficking_concern",
  "stolen_media",
  "spam",
  "fake",
  "duplicate",
  "wrong_contact",
  "video",
  "other",
];

export const REPORT_DETAILS_MAX = 1000;

/** Severity by reason: the most serious reasons are reviewed first. */
export function severityFor(reason: AdReportReason): Severity {
  if (reason === "trafficking_concern") return "S0";
  if (reason === "prohibited_content") return "S1";
  if (reason === "stolen_media" || reason === "wrong_contact") return "S2";
  return "S3";
}

export function cleanDetails(value: unknown): string {
  const text = typeof value === "string" ? value : "";
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, REPORT_DETAILS_MAX);
}

export function hashReporterIp(ip: string): string {
  return createHash("sha256").update(`report:${ip}`).digest("hex").slice(0, 32);
}

/** Creates one report for an ad. The ad is found by its slug or public id; the reporter is not stored, only a hash of the IP. */
export async function fileReport(input: { ad: unknown; reason: unknown; details: unknown; ip: string }) {
  const ad = typeof input.ad === "string" ? input.ad.trim().slice(0, 80) : "";
  if (!ad) throw new ValidationError("Choose the ad you want to report");
  if (typeof input.reason !== "string" || !(REPORT_REASONS as readonly string[]).includes(input.reason)) {
    throw new ValidationError("Choose a reason for the report");
  }
  const reason = input.reason as AdReportReason;
  await connectDb();
  const listing = await Listing.findOne({ $or: [{ slug: ad }, { publicId: ad }] }).select("_id").lean();
  if (!listing) throw new NotFoundError("That ad could not be found");
  if (reason === "video") {
    await VideoReport.create({
      listingId: listing._id,
      reporterIpHash: hashReporterIp(input.ip),
      details: cleanDetails(input.details),
      status: "open",
    });
    return { ok: true as const };
  }
  await Report.create({
    listingId: listing._id,
    reporterIpHash: hashReporterIp(input.ip),
    reason,
    details: cleanDetails(input.details),
    severity: severityFor(reason),
    status: "open",
  });
  return { ok: true as const };
}
