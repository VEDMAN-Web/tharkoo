import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/http";
import { isStaffRole, userFromToken } from "@/server/auth/service";
import { ForbiddenError, UnauthorizedError } from "@/server/http";
import { hashIp } from "@/server/shared/crypto";

export interface AdminCtx {
  actorId: string;
  email: string;
  roles: string[];
  requestId: string;
  ipHash?: string;
}

async function callerIp(): Promise<string | undefined> {
  try {
    return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function adminContext(): Promise<AdminCtx> {
  const found = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!found) throw new UnauthorizedError("Sign in again to make this change.");
  if (!isStaffRole(found.user.roles)) throw new ForbiddenError("Only staff can do this");
  return {
    actorId: found.user.id,
    email: found.user.email,
    roles: [...found.user.roles],
    requestId: randomUUID(),
    ipHash: hashIp(await callerIp()),
  };
}
