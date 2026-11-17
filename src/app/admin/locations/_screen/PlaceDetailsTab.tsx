"use client";

import { TextField } from "@/components/admin/ui";
import { MAX_NAME } from "@/app/admin/_catalog/model";
import type { PlaceDetailView } from "@/server/locations/screen";
import type { Details, DetailsErrors } from "./model";

/** The Details tab of a place: name, web address, a flag code for a country, and the order. Where it is inside is read only. */
export function PlaceDetailsTab({ type, where, draft, errors, onChange }: { type: PlaceDetailView["type"]; where: string; draft: Details; errors: DetailsErrors; onChange: (next: Details) => void }) {
  const set = (patch: Partial<Details>) => onChange({ ...draft, ...patch });
  return (
    <div className="adm-cat-form" data-tk="details-form">
      <TextField label="Name" required max={MAX_NAME} value={draft.name} error={errors.name} help="Shown to visitors in menus, on the Home page and on the page of this place." onChange={(name) => set({ name })} />
      <TextField label="Web address" required value={draft.slug} error={errors.slug} help="Lower case words joined by dashes. If you change it, the old address still leads here." onChange={(slug) => set({ slug })} />
      {type === "country" ? (
        <TextField label="Flag code" required max={2} value={draft.countryCode} error={errors.countryCode} help="Two letters, like IN. The flag comes from it." onChange={(countryCode) => set({ countryCode: countryCode.toUpperCase() })} />
      ) : (
        <div className="adm-cat-field" data-tk="place-inside">
          <span className="adm-k-label">Inside</span>
          <p className="adm-k-help" style={{ margin: 0 }}>{where || "No parent place."}</p>
        </div>
      )}
      <div className="adm-cat-field">
        <label className="adm-k-label" htmlFor="place-order">Order</label>
        <input id="place-order" className="adm-k-input" type="number" inputMode="numeric" value={draft.order} aria-invalid={errors.order ? true : undefined} aria-describedby="place-order-help" onChange={(event) => set({ order: event.target.value })} />
        {errors.order ? <p className="adm-k-err" role="alert">{errors.order}</p> : null}
        <p className="adm-k-help" id="place-order-help">Smaller numbers come first where places are listed by order.</p>
      </div>
    </div>
  );
}
