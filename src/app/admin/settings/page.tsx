import Link from "next/link";
import { Lock } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { can } from "@/lib/admin/perms";
import { isAdminRole } from "@/lib/ui/site-content";
import { CodeOnlyLoginSwitch } from "@/components/auth/CodeOnlyLoginSwitch";
import { codeOnlyLoginEnabled } from "@/server/auth/code-only";
import { readAwayHours } from "@/server/availability/service";
import { idCheckRequired } from "@/server/settings/id-check";
import { readLogos } from "@/server/settings/logo";
import { readRawSite, readSettingsData } from "@/server/settings/settings-admin";
import { readWatermarkSettings } from "@/server/settings/watermark";
import { newDesignOn } from "@/server/site-links/new-design";
import { AwayHoursSetting } from "./AwayHoursSetting";
import { IdCheckSwitch } from "./IdCheckSwitch";
import { LogoSettings } from "./LogoSettings";
import { NewDesignSwitch } from "./NewDesignSwitch";
import { SettingsView } from "./_view/SettingsView";
import { WatermarkSettings } from "./WatermarkSettings";

export const dynamic = "force-dynamic";

/**
 * H8.25 (A25): Settings essentials. Emergency switches, posting rules, undo windows and search engine status are new here; the older
 * switches keep their own components. The raw site record is read only and only for a superadmin (no editor).
 */
export default async function Page() {
  const identity = await getStaffFromHeaders();
  const roles = identity.roles;
  if (!can(roles, "settings.edit") && !can(roles, "settings.emergency")) {
    return (
      <AdminShell title="Settings" hasHeader>
        <div className="adm-card" style={{ padding: 40, textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }} data-tk="no-access">
          <Lock aria-hidden="true" size={28} />
          <h2 style={{ margin: 0, fontSize: 16 }}>You cannot open Settings</h2>
          <p style={{ margin: 0, maxWidth: "44ch" }}>This screen is for admins. Ask an admin if you need it.</p>
          <Link href="/admin/" className="adm-btn adm-btn-quiet">Back to Dashboard</Link>
        </div>
      </AdminShell>
    );
  }
  const isSuperadmin = roles.includes("superadmin");
  const isAdmin = isAdminRole(roles);
  const [data, rawJson, codeOnly, idCheck, watermark, logos, away, newDesign] = await Promise.all([
    readSettingsData(),
    can(roles, "raw.json") ? readRawSite(roles) : Promise.resolve(null),
    isSuperadmin ? codeOnlyLoginEnabled() : Promise.resolve(false),
    isSuperadmin ? idCheckRequired() : Promise.resolve(false),
    isSuperadmin ? readWatermarkSettings() : Promise.resolve(null),
    isAdmin ? readLogos() : Promise.resolve(null),
    isAdmin ? readAwayHours() : Promise.resolve(null),
    isSuperadmin ? newDesignOn() : Promise.resolve(false),
  ]);
  const signIn = isSuperadmin ? (
    <>
      <CodeOnlyLoginSwitch initial={codeOnly} />
      <IdCheckSwitch initial={idCheck} />
    </>
  ) : null;
  const photos =
    watermark || logos ? (
      <>
        {watermark ? <WatermarkSettings initial={watermark} /> : null}
        {logos ? <LogoSettings light={logos.light} dark={logos.dark} /> : null}
      </>
    ) : null;
  const site = (
    <>
      {isSuperadmin ? <NewDesignSwitch initial={newDesign} /> : null}
      {away ? <AwayHoursSetting initial={away} /> : null}
    </>
  );
  return (
    <AdminShell title="Settings" hasHeader>
      <SettingsView data={data} canEmergency={can(roles, "settings.emergency")} canEdit={can(roles, "settings.edit")} signIn={signIn} photos={photos} site={site} rawJson={rawJson} />
    </AdminShell>
  );
}
