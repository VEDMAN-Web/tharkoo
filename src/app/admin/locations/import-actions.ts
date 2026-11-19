"use server";

import { revalidatePath } from "next/cache";
import { adminContext } from "@/server/admin/context";
import { HttpError } from "@/server/http";
import { previewImport, runImport, type ImportKind, type ImportPreview, type ImportResult } from "@/server/locations/import";

type Answer<T> = ({ ok: true } & T) | { ok: false; message: string };
type Input = { kind: ImportKind; from: "builtin" | "upload"; text?: string };

function clean(input: Input) {
  return {
    kind: input.kind === "areas" ? ("areas" as const) : ("cities" as const),
    from: input.from === "upload" ? ("upload" as const) : ("builtin" as const),
    text: input.from === "upload" ? String(input.text ?? "") : undefined,
  };
}

/** Reads the file and says what an import would add. Writes nothing. */
export async function previewImportAction(input: Input): Promise<Answer<{ preview: ImportPreview }>> {
  try {
    return { ok: true, preview: await previewImport(await adminContext(), clean(input)) };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}

/** Adds the new places of the file. The answer carries the audit event, so the screen can offer Undo. */
export async function runImportAction(input: Input): Promise<Answer<{ result: ImportResult }>> {
  try {
    const result = await runImport(await adminContext(), clean(input));
    revalidatePath("/admin/locations/");
    return { ok: true, result };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message };
    throw error;
  }
}
