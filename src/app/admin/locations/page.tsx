import { AdminShell } from "@/components/admin/AdminShell";
import { CatalogPictures } from "@/app/admin/_catalog/CatalogPictures";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { can } from "@/lib/admin/perms";
import { findPlacesForPictures } from "@/server/locations/manage";
import { LocationsManager } from "./LocationsManager";
import { savePlacePicturesAction, searchPlacesAction, undoPlacePicturesAction } from "./picture-actions";

export const dynamic = "force-dynamic";

export default async function Page() {
  const viewer = await getStaffFromHeaders();
  const pictures = can(viewer.roles, "catalogue.edit") ? await findPlacesForPictures("") : null;
  return (
    <AdminShell title="Locations">
      <p className="mb-3 t-small text-muted">
        Add, edit, hide or remove countries, states and cities. The flag comes from the two-letter country code. The footer and the All countries page only show places with live ads.
      </p>
      <LocationsManager />
      {pictures ? (
        <CatalogPictures
          title="Pictures"
          intro="The photo of a city shows on the home page and its band shows at the top of its page. Pictures come from the media library; one that is used here cannot be deleted there."
          noun="place"
          items={pictures}
          save={savePlacePicturesAction}
          undo={undoPlacePicturesAction}
          search={searchPlacesAction}
        />
      ) : null}
    </AdminShell>
  );
}
