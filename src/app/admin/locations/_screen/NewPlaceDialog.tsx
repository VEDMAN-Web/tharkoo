"use client";

import { useState } from "react";
import { Button, TextField } from "@/components/admin/ui";
import { FormDialog } from "@/app/admin/_catalog/FormDialog";
import { MAX_NAME, slugFromName } from "@/app/admin/_catalog/model";
import { createPlaceAction } from "@/server/locations/admin-actions";
import type { PlacesScreenData } from "@/server/locations/screen";

type Kind = "city" | "state" | "country";

/** The small New place dialog: what kind, its name and web address, and where it goes. Pictures and areas come on the next screen. */
export function NewPlaceDialog({ open, choices, onClose, onCreated }: { open: boolean; choices: PlacesScreenData["choices"]; onClose: () => void; onCreated: (id: string) => void }) {
  const [kind, setKind] = useState<Kind>("city");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [parentId, setParentId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const parents = kind === "city" ? choices.states : kind === "state" ? choices.countries : [];

  function reset() {
    setKind("city");
    setName("");
    setSlug("");
    setTouched(false);
    setParentId("");
    setCode("");
    setError("");
  }

  async function create() {
    if (!name.trim()) return setError("Write a name.");
    if (!slug.trim()) return setError("Write a web address.");
    if (kind !== "country" && !parentId) return setError(kind === "city" ? "Choose the state it is in." : "Choose the country it is in.");
    if (kind === "country" && !/^[A-Za-z]{2}$/.test(code.trim())) return setError("Write the two-letter flag code, like IN.");
    setBusy(true);
    const result = await createPlaceAction({ type: kind, name, slug: slug.trim(), parentId: kind === "country" ? null : parentId, countryCode: code.trim() });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    reset();
    onCreated(result.id);
  }

  const close = () => {
    reset();
    onClose();
  };
  return (
    <FormDialog
      open={open}
      title="New place"
      intro="Add the kind, the name and where it goes. You add pictures and areas on the next screen."
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <span className="adm-k-sp" />
          <Button kind="primary" busy={busy} onClick={() => void create()}>Create place</Button>
        </>
      }
    >
      <div className="adm-cat-field">
        <label className="adm-k-label" htmlFor="new-place-kind">Kind</label>
        <select id="new-place-kind" className="adm-k-input" value={kind} onChange={(event) => { setKind(event.target.value as Kind); setParentId(""); setError(""); }}>
          <option value="city">City</option>
          <option value="state">State</option>
          <option value="country">Country</option>
        </select>
      </div>
      <TextField label="Name" required max={MAX_NAME} value={name} onChange={(next) => { setName(next); if (!touched) setSlug(slugFromName(next)); setError(""); }} />
      <TextField label="Web address" required value={slug} help="Lower case words joined by dashes." onChange={(next) => { setSlug(next); setTouched(true); setError(""); }} />
      {kind === "country" ? (
        <TextField label="Flag code" required max={2} value={code} help="Two letters, like IN." onChange={(next) => { setCode(next.toUpperCase()); setError(""); }} />
      ) : (
        <div className="adm-cat-field">
          <label className="adm-k-label" htmlFor="new-place-parent">
            {kind === "city" ? "State" : "Country"}
            <span className="adm-k-req" aria-hidden="true"> *</span>
          </label>
          <select id="new-place-parent" className="adm-k-input" value={parentId} onChange={(event) => { setParentId(event.target.value); setError(""); }}>
            <option value="" disabled>{kind === "city" ? "Choose a state" : "Choose a country"}</option>
            {parents.map((row) => (
              <option key={row.id} value={row.id}>{row.where ? `${row.name} (${row.where})` : row.name}</option>
            ))}
          </select>
        </div>
      )}
      {error ? <p className="adm-k-err" role="alert" data-tk="new-place-error">{error}</p> : null}
    </FormDialog>
  );
}
