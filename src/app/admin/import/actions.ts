"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { HttpError } from "@/server/http";
import {
  dryRunImport,
  runImport,
  type DryRunReport,
  type ImportReport,
  type ImportStatus,
} from "@/server/listings/import";

export type ImportActionResult =
  | { ok: true; kind: "dry"; report: DryRunReport }
  | { ok: true; kind: "import"; report: ImportReport }
  | { ok: false; error: string };

async function actorFromSession() {
  const jar = await cookies();
  const found = await userFromToken(jar.get(SESSION_COOKIE)?.value);
  return found ? { id: found.user.id, roles: found.user.roles } : null;
}

/** Both steps run on the server with the session role check; the browser only sends the file text. */
export async function importAction(input: {
  step: "dry" | "import";
  partnerEmail: string;
  csv: string;
  status: ImportStatus;
}): Promise<ImportActionResult> {
  const actor = await actorFromSession();
  if (!actor) return { ok: false, error: "Sign in again" };
  try {
    if (input.step === "dry") {
      return { ok: true, kind: "dry", report: await dryRunImport(actor, input.partnerEmail, input.csv) };
    }
    const report = await runImport(actor, input.partnerEmail, input.csv, input.status === "active" ? "active" : "pending", randomUUID());
    return { ok: true, kind: "import", report };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("listing import failed", error);
    return { ok: false, error: "The import failed. Nothing more was changed." };
  }
}
