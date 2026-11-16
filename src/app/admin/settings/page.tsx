import { AdminShell } from "@/components/admin/AdminShell";
import Link from "next/link";
import { CollectionEditor } from "@/components/admin/CollectionEditor";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { isAdminRole } from "@/lib/ui/site-content";
import { readAwayHours } from "@/server/availability/service";
import { idCheckRequired } from "@/server/settings/id-check";
import { readWatermarkSettings } from "@/server/settings/watermark";
import { newDesignOn } from "@/server/site-links/new-design";
import { readLogos } from "@/server/settings/logo";
import { AwayHoursSetting } from "./AwayHoursSetting";
import { IdCheckSwitch } from "./IdCheckSwitch";
import { LogoSettings } from "./LogoSettings";
import { NewDesignSwitch } from "./NewDesignSwitch";
import { WatermarkSettings } from "./WatermarkSettings";

export const dynamic = "force-dynamic";

export default async function Page() {
  // H6.14: the ID-check switch is for superadmins only. Others do not see it.
  // H6.18: the watermark is for superadmins only too.
  // H7.5: the away hours are for admins and superadmins.
  const identity = await getStaffFromHeaders();
  const isSuperadmin = identity.roles.includes("superadmin");
  const isAdmin = isAdminRole(identity.roles);
  return (
    <AdminShell title="Settings">
      {isSuperadmin ? <NewDesignSwitch initial={await newDesignOn()} /> : null}
      {isSuperadmin ? <IdCheckSwitch initial={await idCheckRequired()} /> : null}
      {isSuperadmin ? <WatermarkSettings initial={await readWatermarkSettings()} /> : null}
      {isAdmin ? <LogoSettings {...(({ light, dark }) => ({ light, dark }))(await readLogos())} /> : null}
      {isAdmin ? <AwayHoursSetting initial={await readAwayHours()} /> : null}
      <p className="mb-3 t-small text-muted">Age gate, cookies, hours and brand. Also on the CMS homepage editor.</p>
      <p className="mb-3 t-small">
        Live video tours: <Link href="/admin/settings/video-tours/">switch on per category and set the credit price</Link>.
      </p>
      <p className="mb-3 t-small">
        Support chat text and buttons: <Link href="/admin/settings/chat/">edit the live chat</Link>. Header and footer: <Link href="/admin/menus/">menus and footer</Link>.
      </p>
      <CollectionEditor model="Site" title="Settings" />
    </AdminShell>
  );
}
