import { connectDb } from "@/lib/db";
import { siteUrl } from "@/lib/utils";
import { ValidationError } from "@/server/http";
import { AuditEvent } from "@/server/models/trust";
import { postIndexNow } from "@/server/indexnow/ping";
import { assertSeoEditor, recordSeo, type SeoActor } from "@/app/admin/seo/staff";

export const MANUAL_ACTION = "seo.indexnow.submit";
export const MANUAL_MAX_URLS = 100;

/** Turns pasted lines (paths or full addresses on this site) into clean full URLs. Throws on anything else. */
export function parseSubmission(input: string): string[] {
  const origin = new URL(siteUrl());
  const out = new Set<string>();
  const bad: string[] = [];
  for (const line of String(input ?? "").split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;
    try {
      const url = text.startsWith("/") && !text.startsWith("//") ? new URL(text, origin) : new URL(text);
      if (url.host !== origin.host || !/^https?:$/.test(url.protocol)) throw new Error("other host");
      url.hash = "";
      out.add(url.toString());
    } catch {
      bad.push(text.slice(0, 80));
    }
  }
  if (bad.length) throw new ValidationError("Some lines are not addresses on this site", { urls: bad.slice(0, 5).map((text) => `Not valid: ${text}`) });
  if (out.size === 0) throw new ValidationError("Enter at least one address", { urls: ["Enter at least one address"] });
  if (out.size > MANUAL_MAX_URLS) throw new ValidationError(`At most ${MANUAL_MAX_URLS} addresses at a time`, { urls: [`At most ${MANUAL_MAX_URLS} addresses at a time`] });
  return [...out];
}

export interface ManualResult {
  urls: number;
  sent: boolean;
  /** Why nothing was sent, when sent is false. */
  note: string;
}

/** Sends the URLs to IndexNow when INDEXNOW_KEY is set; otherwise only logs the dry run. */
export async function submitManual(actor: SeoActor, input: string, fetchImpl?: typeof fetch): Promise<ManualResult> {
  assertSeoEditor(actor);
  const urls = parseSubmission(input);
  let result: ManualResult;
  if (!process.env.INDEXNOW_KEY) {
    result = { urls: urls.length, sent: false, note: "IndexNow key is not set on this server, so nothing was sent." };
  } else {
    try {
      const out = await postIndexNow(urls, fetchImpl);
      result = { urls: urls.length, sent: out.sent, note: out.sent ? "Sent to IndexNow." : "IndexNow did not accept the request." };
    } catch {
      result = { urls: urls.length, sent: false, note: "Could not reach IndexNow." };
    }
  }
  await recordSeo(actor, MANUAL_ACTION, "indexnow", "manual", {}, { ...result, sample: urls.slice(0, 5) });
  return result;
}

export interface SubmissionLogRow {
  at: string;
  by: string;
  urls: number;
  sent: boolean;
  note: string;
}

export async function recentSubmissions(limit = 20): Promise<SubmissionLogRow[]> {
  await connectDb();
  const rows = await AuditEvent.find({ action: MANUAL_ACTION }).sort({ createdAt: -1 }).limit(limit).lean();
  return rows.map((row) => {
    const after = (row.after ?? {}) as { urls?: number; sent?: boolean; note?: string };
    return {
      at: row.createdAt ? new Date(row.createdAt).toISOString() : "",
      by: row.actorId ? String(row.actorId) : "staff",
      urls: Number(after.urls ?? 0),
      sent: after.sent === true,
      note: String(after.note ?? ""),
    };
  });
}
