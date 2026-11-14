import { ForbiddenError, UnauthorizedError } from "@/server/http";
import { DESK_ROLES } from "@/server/support/constants";

/** The signed-in person acting on the desk. `id` is the user id, used for audit rows and assignment. */
export interface DeskActor {
  id: string;
  roles: readonly string[];
}

export function canWorkDesk(roles: readonly string[]): boolean {
  return roles.some((role) => (DESK_ROLES as readonly string[]).includes(role));
}

export function assertDeskActor(actor: DeskActor | null): asserts actor is DeskActor {
  if (!actor) throw new UnauthorizedError("Sign in required");
  if (!canWorkDesk(actor.roles)) throw new ForbiddenError("Only support staff can use the support desk");
}
