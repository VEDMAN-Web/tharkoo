import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import type { DeskActor } from "@/server/support/access";
import { connectDb } from "@/lib/db";

/** The signed-in viewer for a server-rendered page, or null. Used by /admin/support pages. */
export async function currentDeskActor(): Promise<DeskActor | null> {
  await connectDb();
  const jar = await cookies();
  const found = await userFromToken(jar.get(SESSION_COOKIE)?.value);
  if (!found) return null;
  return { id: found.user.id, roles: found.user.roles };
}
