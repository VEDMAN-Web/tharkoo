"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { HttpError } from "@/server/http";
import { saveShellConfig } from "@/server/site-links/shell-config";
import type { ShellConfig } from "@/server/site-links/shell-config-rules";

export type ShellSaveResult = { ok: true; config: ShellConfig } | { ok: false; error: string };

/** H7.1: admin saves the header, footer and chat text. The service checks the role, cleans the text and audits the change. */
export async function saveShellAction(input: unknown): Promise<ShellSaveResult> {
  const jar = await cookies();
  const found = await userFromToken(jar.get(SESSION_COOKIE)?.value);
  if (!found) return { ok: false, error: "Sign in again" };
  try {
    const config = await saveShellConfig({ actorId: found.user.id, roles: found.user.roles, config: input, requestId: randomUUID() });
    return { ok: true, config };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("shell config save failed", error);
    return { ok: false, error: "Nothing was saved. Try again." };
  }
}
