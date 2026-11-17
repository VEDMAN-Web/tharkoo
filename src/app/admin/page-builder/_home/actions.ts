"use server";

import { adminContext } from "@/server/admin/context";
import { HttpError } from "@/server/http";
import { loadHomeBuilder, publishHome, restoreHomeVersion, saveHomeDraft, setHomeSwitch, type HomeBuilderState } from "@/server/layout/home-builder";
import type { BlockBase } from "@/server/models/layout";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

async function run<T>(job: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await job()) } as Result<T>;
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("page builder action failed", error);
    return { ok: false, error: "Something went wrong. Nothing was changed." };
  }
}

export async function loadHomeAction(): Promise<Result<{ state: HomeBuilderState }>> {
  return run(async () => ({ state: await loadHomeBuilder(await adminContext()) }));
}

export async function saveHomeDraftAction(blocks: unknown): Promise<Result<{ blocks: BlockBase[]; savedAt: string }>> {
  return run(async () => saveHomeDraft(await adminContext(), blocks));
}

export async function publishHomeAction(note: string): Promise<Result<{ version: number; eventId: string; canUndo: boolean }>> {
  return run(async () => publishHome(await adminContext(), note.trim() || undefined));
}

export async function restoreHomeAction(version: number): Promise<Result<{ blocks: BlockBase[] }>> {
  return run(async () => restoreHomeVersion(await adminContext(), version));
}

export async function setHomeSwitchAction(on: boolean): Promise<Result<{ on: boolean; version: number | null; changed: boolean; eventId: string; canUndo: boolean }>> {
  return run(async () => setHomeSwitch(await adminContext(), { on }));
}
