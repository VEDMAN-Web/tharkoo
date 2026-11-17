import Link from "next/link";
import { Lock } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { adminContext } from "@/server/admin/context";
import { can } from "@/lib/admin/perms";
import { getUserDetail, listUsers, parseUserQuery } from "@/server/admin/users";
import { canAdjustCredits, canSeeCredits, getCreditsTab } from "@/server/billing/staff-credits";
import { NotFoundError } from "@/server/http";
import { UsersView } from "./_list/UsersView";

export const dynamic = "force-dynamic";

/** H8.8 (A8): the Users screen. Tab, search, page and the open user all live in the address. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await getStaffFromHeaders();
  if (!can(identity.roles, "users.view")) {
    return (
      <AdminShell title="Users">
        <div className="adm-card" style={{ padding: 40, textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }} data-tk="no-access">
          <Lock aria-hidden="true" size={28} />
          <h2 style={{ margin: 0, fontSize: 16 }}>You cannot open Users</h2>
          <p style={{ margin: 0, maxWidth: "44ch" }}>This screen is for moderators, trust and safety, support and admins. Ask an admin if you need it.</p>
          <Link href="/admin/" className="adm-btn adm-btn-quiet">Back to Dashboard</Link>
        </div>
      </AdminShell>
    );
  }
  const params = await searchParams;
  const query = parseUserQuery(params);
  const list = await listUsers(query, identity.roles);
  const open = typeof params.open === "string" ? params.open : "";
  let detail = null;
  if (open) {
    try {
      detail = await getUserDetail(open, identity.roles);
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
    }
  }
  const credits = detail && canSeeCredits(identity.roles) ? await getCreditsTab(detail.user.id, identity.roles, (await adminContext()).actorId) : null;
  const access = {
    ban: can(identity.roles, "users.ban"),
    logout: can(identity.roles, "users.logout"),
    credits: canSeeCredits(identity.roles),
    adjust: canAdjustCredits(identity.roles),
  };
  return (
    <AdminShell title="Users">
      <UsersView list={list} detail={detail} credits={credits} access={access} />
    </AdminShell>
  );
}
