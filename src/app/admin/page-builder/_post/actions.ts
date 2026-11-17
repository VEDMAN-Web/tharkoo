"use server";

import { adminContext } from "@/server/admin/context";
import { HttpError } from "@/server/http";
import { loadPostBuilder, publishPost, restorePostVersion, savePostDraft, type PostBuilderState } from "@/server/layout/post-builder";
import type { BlockBase } from "@/server/models/layout";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

async function run<T>(job: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await job()) } as Result<T>;
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("post-ad builder action failed", error);
    return { ok: false, error: "Something went wrong. Nothing was changed." };
  }
}

export async function loadPostAction(): Promise<Result<{ state: PostBuilderState }>> {
  return run(async () => ({ state: await loadPostBuilder(await adminContext()) }));
}

export async function savePostDraftAction(blocks: unknown): Promise<Result<{ blocks: BlockBase[]; savedAt: string }>> {
  return run(async () => savePostDraft(await adminContext(), blocks));
}

export async function publishPostAction(note: string): Promise<Result<{ version: number; eventId: string; canUndo: boolean }>> {
  return run(async () => publishPost(await adminContext(), note.trim() || undefined));
}

export async function restorePostAction(version: number): Promise<Result<{ blocks: BlockBase[] }>> {
  return run(async () => restorePostVersion(await adminContext(), version));
}
