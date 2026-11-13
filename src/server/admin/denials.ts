import { AuditRepository } from "@/server/audit";
import { User } from "@/server/models";

const audit = new AuditRepository();

/** Writes an audit entry for a staff request that the role allowlist refused. */
export async function auditAdminDenial(actor: { email: string; roles: readonly string[] }, model: string, op: string) {
  try {
    const user = actor.email ? await User.findOne({ email: actor.email }).select("_id") : null;
    await audit.append({
      actorId: user?._id?.toString() ?? null,
      actorType: "admin",
      action: "admin.api.denied",
      targetType: "model",
      targetId: model,
      after: { op, roles: [...actor.roles] },
      requestId: crypto.randomUUID(),
    });
  } catch (error) {
    // The refusal itself still goes out; a failed audit write is logged, not hidden.
    console.error("admin denial could not be audited", error);
  }
}
