"use server";

import { headers } from "next/headers";
import { logNotFound } from "@/server/seo/notfound-log";

/**
 * Called by the 404 page in the visitor's browser. The 404 page itself may come from a cached render, so the
 * address of the missing page is read in the browser and sent here instead of being read from request headers.
 */
export async function recordNotFoundAction(path: string, referrer: string) {
  const seen = await headers();
  await logNotFound({
    path: String(path ?? "").slice(0, 300),
    userAgent: seen.get("user-agent"),
    referer: String(referrer ?? "").slice(0, 500),
  });
}
