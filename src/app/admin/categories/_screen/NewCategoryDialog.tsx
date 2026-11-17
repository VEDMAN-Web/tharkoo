"use client";

import { useState } from "react";
import { Button, TextField } from "@/components/admin/ui";
import { createCategoryAction } from "../manage-actions";
import { FormDialog } from "./FormDialog";
import { KIND_HELP, KIND_OPTIONS, MAX_NAME, slugFromName } from "./model";

/** The small New category dialog: a name, a web address and a kind. Everything else is on the category's own tabs afterwards. */
export function NewCategoryDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (slug: string) => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [kind, setKind] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setName("");
    setSlug("");
    setTouched(false);
    setKind("");
    setError("");
  }

  async function create() {
    if (!name.trim()) return setError("Write a name.");
    if (!slug.trim()) return setError("Write a web address.");
    if (!kind) return setError("Choose a kind.");
    setBusy(true);
    const result = await createCategoryAction({ name, slug: slug.trim(), kind });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    const created = (result.data as { slug?: string } | undefined)?.slug ?? slug.trim();
    reset();
    onCreated(created);
  }

  return (
    <FormDialog
      open={open}
      title="New category"
      intro="Add the name, the web address and the kind. You add pictures, fields and sub-categories on the next screen."
      onClose={() => {
        reset();
        onClose();
      }}
      footer={
        <>
          <Button onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <span className="adm-k-sp" />
          <Button kind="primary" busy={busy} onClick={() => void create()}>Create category</Button>
        </>
      }
    >
      <TextField label="Name" required max={MAX_NAME} value={name} onChange={(next) => { setName(next); if (!touched) setSlug(slugFromName(next)); setError(""); }} />
      <TextField label="Web address" required value={slug} help="Lower case words joined by dashes. You can change it later; the old address will still lead here." onChange={(next) => { setSlug(next); setTouched(true); setError(""); }} />
      <div className="adm-cat-field">
        <label className="adm-k-label" htmlFor="new-cat-kind">
          Kind<span className="adm-k-req" aria-hidden="true"> *</span>
        </label>
        <select id="new-cat-kind" className="adm-k-input" value={kind} onChange={(event) => { setKind(event.target.value); setError(""); }}>
          <option value="" disabled>
            Choose a kind
          </option>
          {KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="adm-k-help">{KIND_HELP}</p>
      </div>
      {error ? <p className="adm-k-err" role="alert" data-tk="new-cat-error">{error}</p> : null}
    </FormDialog>
  );
}
