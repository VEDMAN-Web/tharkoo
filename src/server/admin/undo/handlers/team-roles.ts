import { can } from "@/lib/admin/perms";
import { anotherSuperadminExists, staffRolesOf } from "@/server/admin/team";
import { ConflictError } from "@/server/http";
import { User } from "@/server/models";
import type { UndoHandler } from "../registry";

/**
 * Undo of a role change or of Remove access (H8.46). It uses ONLY the saved undo data: `roles` (what to put back) and `expect`
 * (what the roles were right after the change). It refuses when the roles changed since. Ended sign-ins are not brought back.
 * Undoing the undo (redo) applies the change again from the data the undo saved. The last superadmin never loses the role this way either.
 */
const handler: UndoHandler = {
  canUndo(ctx) {
    return can(ctx.roles, "team.edit");
  },

  async conflict(event) {
    const user = await User.findById(event.targetId).select("roles").lean<{ roles: string[] } | null>();
    const expect = event.take<string[]>("expect");
    if (user && staffRolesOf(user.roles).join() === staffRolesOf(expect).join()) return null;
    return { changedBy: null, at: new Date().toISOString(), message: "Their roles were changed since. Open Team and roles to set them again." };
  },

  async run(_ctx, event) {
    const roles = event.take<string[]>("roles").map(String);
    const expect = event.take<string[]>("expect").map(String);
    if (expect.includes("superadmin") && !roles.includes("superadmin") && !(await anotherSuperadminExists(event.targetId))) {
      throw new ConflictError("This is the last superadmin. Make someone else a superadmin first.");
    }
    await User.updateOne({ _id: event.targetId }, { $set: { roles } });
    return {
      after: { roles },
      summary: `${event.undoOf ? "Applied again" : "Undid the change"}: roles are ${staffRolesOf(roles).join(", ").replace(/_/g, " ") || "no staff role"}`,
      undoData: { roles: expect, expect: roles },
    };
  },
};

export default handler;
