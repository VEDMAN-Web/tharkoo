"use client";

import { useState } from "react";
import { createPlaceAction } from "@/server/locations/admin-actions";
import { Notice } from "@/components/admin/ui";
import type { AdFormPlace } from "@/server/listings/admin-form";

export interface PlaceChoice {
  countryId: string;
  stateId: string;
  cityId: string;
  districtId: string;
}

export const NO_PLACE: PlaceChoice = { countryId: "", stateId: "", cityId: "", districtId: "" };

interface Props {
  places: AdFormPlace[];
  value: PlaceChoice;
  onChange: (next: PlaceChoice) => void;
  onPlaceAdded: (place: AdFormPlace) => void;
}

const field = { display: "grid", gap: 4, minWidth: 0 } as const;

function Select({ label, value, options, onChange, disabled, help }: { label: string; value: string; options: AdFormPlace[]; onChange: (next: string) => void; disabled?: boolean; help?: string }) {
  return (
    <label style={field}>
      <span className="adm-field-label">{label}</span>
      <select className="adm-input" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} style={{ maxWidth: "100%" }}>
        <option value="">Choose</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      {help ? <span className="adm-field-help">{help}</span> : null}
    </label>
  );
}

/** Country, then state, then city, then district. A city that is missing can be added under the chosen state. */
export function AdPlacePicker({ places, value, onChange, onPlaceAdded }: Props) {
  const [newCity, setNewCity] = useState("");
  const [note, setNote] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const countries = places.filter((place) => place.type === "country");
  const states = places.filter((place) => place.type === "state" && place.parentId === value.countryId);
  const cityParent = value.stateId || value.countryId;
  const cities = places.filter((place) => place.type === "city" && place.parentId === cityParent);
  const districts = places.filter((place) => place.type === "district" && place.parentId === value.cityId);

  async function addCity() {
    setBusy(true);
    setNote(null);
    const name = newCity.trim();
    const result = await createPlaceAction({ type: "city", parentId: value.stateId, name });
    setBusy(false);
    if (!result.ok) {
      setNote({ kind: "error", text: result.message ?? "The city could not be added" });
      return;
    }
    const id = result.id;
    onPlaceAdded({ id, type: "city", name, parentId: value.stateId, countryCode: "" });
    onChange({ ...value, cityId: id, districtId: "" });
    setNewCity("");
    setNote({ kind: "info", text: `${name} was added to Locations.` });
  }

  return (
    <div className="adm-stack" style={{ minWidth: 0 }}>
      <Select label="Country" value={value.countryId} options={countries} onChange={(countryId) => onChange({ ...NO_PLACE, countryId })} />
      <Select
        label="State"
        value={value.stateId}
        options={states}
        disabled={!value.countryId}
        help={value.countryId && states.length === 0 ? "This country has no states yet. Add one in Locations first." : undefined}
        onChange={(stateId) => onChange({ ...NO_PLACE, countryId: value.countryId, stateId })}
      />
      <Select
        label="City"
        value={value.cityId}
        options={cities}
        disabled={!cityParent}
        onChange={(cityId) => onChange({ ...value, cityId, districtId: "" })}
      />
      {value.stateId ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "end" }}>
          <label style={{ ...field, flex: "1 1 180px" }}>
            <span className="adm-field-label">Add a city that is missing</span>
            <input className="adm-input" value={newCity} maxLength={80} onChange={(event) => setNewCity(event.target.value)} placeholder="City name" />
          </label>
          <button type="button" className="adm-btn" disabled={busy || !newCity.trim()} onClick={addCity}>
            Add new city
          </button>
        </div>
      ) : null}
      {note ? <Notice kind={note.kind}>{note.text}</Notice> : null}
      {value.cityId && districts.length ? (
        <Select label="District (optional)" value={value.districtId} options={districts} onChange={(districtId) => onChange({ ...value, districtId })} />
      ) : null}
    </div>
  );
}
