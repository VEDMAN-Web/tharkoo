"use client";

import { useState } from "react";
import { Button, TextField } from "@/components/admin/ui";
import { createCategoryAction } from "../manage-actions";
import { saveCategoryVideoAction } from "../video-actions";
import { COIN_MAX, COIN_MIN, isCoinPrice, lockOf } from "@/app/admin/settings/video-tours/shared";
import { VideoCallsFields, type VideoDraft } from "./VideoCallsFields";
import { FormDialog } from "@/app/admin/_catalog/FormDialog";
import type { KindView } from "@/lib/category-kinds";
import { KIND_HELP, MAX_NAME, slugFromName } from "./model";

/** The small New category dialog: a name, a web address and a kind. Everything else is on the category's own tabs afterwards. */
export function NewCategoryDialog({ open, kinds, sharePercent, canVideo, onClose, onCreated }: { open: boolean; kinds: KindView[]; sharePercent: number; canVideo: boolean; onClose: () => void; onCreated: (slug: string) => void }) {
  const [video, setVideo] = useState<VideoDraft>({ enabled: false, coins: String(COIN_MIN) });
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
    setVideo({ enabled: false, coins: String(COIN_MIN) });
  }
  const lock = lockOf({ kind: kind || null, peopleLocked: kind === "people", kindVideoOff: kinds.find((option) => option.key === kind)?.videoTours === false });

  async function create() {
    if (!name.trim()) return setError("Write a name.");
    if (!slug.trim()) return setError("Write a web address.");
    if (!kind) return setError("Choose a kind.");
    if (canVideo && !lock && !isCoinPrice(video.coins)) return setError(`The price per call is a whole number from ${COIN_MIN} to ${COIN_MAX}.`);
    setBusy(true);
    const result = await createCategoryAction({ name, slug: slug.trim(), kind });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    const made = result.data as { slug?: string; id?: string } | undefined;
    const created = made?.slug ?? slug.trim();
    if (canVideo && !lock && made?.id && (video.enabled || video.coins !== String(COIN_MIN))) {
      const saved = await saveCategoryVideoAction(made.id, { enabled: video.enabled, coins: Number(video.coins) });
      if (!saved.ok) setError(`The category was created, but the video calls were not saved: ${saved.message}`);
    }
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
          {kinds.map((option) => (
            <option key={option.key} value={option.key}>
              {option.name}
            </option>
          ))}
        </select>
        <p className="adm-k-help">{KIND_HELP}</p>
      </div>
      <VideoCallsFields draft={video} lock={lock} canEdit={canVideo} sharePercent={sharePercent} idPrefix="new-cat-video" onChange={setVideo} />
      {error ? <p className="adm-k-err" role="alert" data-tk="new-cat-error">{error}</p> : null}
    </FormDialog>
  );
}
