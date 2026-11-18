"use client";

import { useState } from "react";
import "@/app/admin/_catalog/catalog.css";
import { FormDialog } from "@/app/admin/_catalog/FormDialog";
import { Button, TextField } from "@/components/admin/ui";
import { BULK_TYPED_FROM } from "@/lib/admin/ads-bulk-rules";
import { moveAdsAction } from "../_actions/actions";

type Category = { id: string; name: string };

/**
 * "Move to category": pick where the ads go, and whether it is the selected ads or every ad that matches the current filters.
 * Twenty or more at once ask for the number to be typed. The move is one change with one Undo.
 */
export function MoveDialog({
  open,
  categories,
  selected,
  matching,
  search,
  onClose,
  onMoved,
}: {
  open: boolean;
  categories: Category[];
  selected: string[];
  matching: number;
  search: string;
  onClose: () => void;
  onMoved: (answer: { moved: number; alreadyThere: number; categoryName: string; eventId: string }) => void;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [scope, setScope] = useState<"selected" | "filter">("selected");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const count = scope === "filter" ? matching : selected.length;
  const typed = count >= BULK_TYPED_FROM;

  function close() {
    setCategoryId("");
    setScope("selected");
    setConfirm("");
    setError("");
    onClose();
  }

  async function move() {
    if (!categoryId) return setError("Choose the category to move the ads to.");
    if (typed && confirm.trim() !== String(count)) return setError(`Type ${count} to confirm.`);
    setBusy(true);
    const answer = await moveAdsAction({ categoryId, scope, ids: selected, search, confirm });
    setBusy(false);
    if (!answer.ok) return setError(answer.message);
    close();
    onMoved(answer);
  }

  return (
    <FormDialog
      open={open}
      title="Move ads to another category"
      intro="The sub-category of each ad is cleared, because it belongs to the old category. You can undo this for a while."
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <span className="adm-k-sp" />
          <Button kind="primary" busy={busy} onClick={() => void move()}>{`Move ${count.toLocaleString("en-IN")} ${count === 1 ? "ad" : "ads"}`}</Button>
        </>
      }
    >
      <div className="adm-cat-field">
        <label className="adm-k-label" htmlFor="move-category">Move to</label>
        <select id="move-category" className="adm-k-input" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setError(""); }}>
          <option value="" disabled>Choose a category</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </div>
      {matching > selected.length ? (
        <fieldset className="adm-cat-field" style={{ border: 0, padding: 0, margin: 0 }} data-tk="move-scope">
          <legend className="adm-k-label">Which ads</legend>
          <label className="adm-k-opt">
            <input type="radio" name="move-scope" checked={scope === "selected"} onChange={() => { setScope("selected"); setConfirm(""); setError(""); }} />
            <span>{`The ${selected.length.toLocaleString("en-IN")} selected ${selected.length === 1 ? "ad" : "ads"}`}</span>
          </label>
          <label className="adm-k-opt">
            <input type="radio" name="move-scope" checked={scope === "filter"} onChange={() => { setScope("filter"); setConfirm(""); setError(""); }} />
            <span>{`All ${matching.toLocaleString("en-IN")} ads that match the current filters`}</span>
          </label>
        </fieldset>
      ) : null}
      {typed ? <TextField label={`Type ${count} to confirm`} value={confirm} onChange={(next) => { setConfirm(next); setError(""); }} /> : null}
      {error ? <p className="adm-k-err" role="alert" data-tk="move-error">{error}</p> : null}
    </FormDialog>
  );
}
