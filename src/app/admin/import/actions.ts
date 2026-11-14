"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { HttpError } from "@/server/http";
import { dryRunImport, type DryRunReport, type ImportActor, type ImportStatus } from "@/server/listings/import";
import { createImportJob, getImportJob, openImportJob, runImportChunk, type JobSummary } from "@/server/import/job";

export type ImportResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function actorFromSession(): Promise<ImportActor | null> {
  const jar = await cookies();
  const found = await userFromToken(jar.get(SESSION_COOKIE)?.value);
  return found ? { id: found.user.id, roles: found.user.roles } : null;
}

/** Every step checks the session and the role on the server. The browser sends the CSV text and the image names only. */
async function run<T>(job: (actor: ImportActor) => Promise<T>): Promise<ImportResult<T>> {
  const actor = await actorFromSession();
  if (!actor) return { ok: false, error: "Sign in again" };
  try {
    return { ok: true, data: await job(actor) };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("listing import failed", error);
    return { ok: false, error: "The import failed. Nothing more was changed." };
  }
}

/** Step 1: check the file. Writes nothing. */
export async function dryRunAction(input: { partnerEmail: string; csv: string; fileNames: string[] }): Promise<ImportResult<DryRunReport>> {
  return run((actor) => dryRunImport(actor, input.partnerEmail, input.csv, input.fileNames));
}

/** Step 2a: save the job. The page then uploads the photos it lists and calls chunkAction until done. */
export async function createJobAction(input: {
  partnerEmail: string;
  csv: string;
  fileNames: string[];
  status: ImportStatus;
}): Promise<ImportResult<{ job: JobSummary; report: DryRunReport }>> {
  return run((actor) => createImportJob(actor, { ...input, status: input.status === "active" ? "active" : "pending" }, randomUUID()));
}

/** The unfinished job of this staff member, if one exists. */
export async function openJobAction(): Promise<ImportResult<JobSummary | null>> {
  return run((actor) => openImportJob(actor));
}

export async function jobAction(jobId: string): Promise<ImportResult<JobSummary>> {
  return run((actor) => getImportJob(actor, jobId));
}

/** Step 2b: import the next block of rows. Call again until `state` is "done". */
export async function chunkAction(jobId: string): Promise<ImportResult<JobSummary>> {
  return run((actor) => runImportChunk(actor, jobId, randomUUID()));
}
