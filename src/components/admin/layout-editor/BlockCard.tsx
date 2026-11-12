"use client";

import { TextField } from "../ui/TextField";
import { Toggle } from "../ui/Toggle";
import { FieldsForm } from "./FieldControls";
import { metaFor, type Props } from "./fields";

export type Device = "mobile" | "desktop";

/** One block as the editor holds it. `id` is missing until the server has saved the block. */
export interface BlockDraft {
  id?: string;
  type: string;
  visible: boolean;
  label?: string;
  devices?: Device[];
  startsAt?: string | null;
  endsAt?: string | null;
  props: Props;
}

const DEVICE_CHIPS: { id: "both" | Device; label: string }[] = [
  { id: "both", label: "Both" },
  { id: "mobile", label: "Phone only" },
  { id: "desktop", label: "Desktop only" },
];

const deviceChip = (devices?: Device[]): "both" | Device => (devices?.length === 1 ? devices[0] : "both");

/** ISO string to the local value a datetime-local input wants, and back. */
export function isoToLocal(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localToIso(local: string): string | null {
  if (!local) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function blockTitle(block: BlockDraft): string {
  const meta = metaFor(block.type);
  return block.label?.trim() || meta.label;
}

export function BlockCard({
  block,
  index,
  count,
  expanded,
  isOver,
  onToggle,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
  atMax,
  dragHandle,
  dropProps,
}: {
  block: BlockDraft;
  index: number;
  count: number;
  expanded: boolean;
  isOver: boolean;
  onToggle: () => void;
  onChange: (next: BlockDraft) => void;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  atMax: boolean;
  dragHandle: object;
  dropProps: object;
}) {
  const meta = metaFor(block.type);
  const name = blockTitle(block);
  const patch = (next: Partial<BlockDraft>) => onChange({ ...block, ...next });
  const chip = deviceChip(block.devices);
  return (
    <li className={`lay-block ${isOver ? "is-over" : ""} ${block.visible ? "" : "is-hidden"}`} data-drag-row {...dropProps}>
      <div className="lay-block-head">
        <span className="adm-sort-handle" aria-hidden {...dragHandle}>⠿</span>
        <button type="button" className="lay-block-title" aria-expanded={expanded} onClick={onToggle}>
          <strong>{name}</strong>
          <span className="lay-type">{block.type}</span>
          {!meta.deletable ? <span className="lay-type">required</span> : null}
          {!block.visible ? <span className="lay-type is-warn">hidden</span> : null}
          {chip !== "both" ? <span className="lay-type">{chip === "mobile" ? "phone" : "desktop"}</span> : null}
        </button>
        <Toggle label="Visible" checked={block.visible} onChange={(visible) => patch({ visible })} />
      </div>
      <div className="lay-block-tools">
        <button type="button" className="adm-sort-move" aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => onMove(index - 1)}>↑</button>
        <button type="button" className="adm-sort-move" aria-label={`Move ${name} down`} disabled={index === count - 1} onClick={() => onMove(index + 1)}>↓</button>
        <button type="button" className="adm-btn adm-btn-quiet" disabled={atMax} title={atMax ? "This page already has the most blocks of this type" : undefined} onClick={onDuplicate}>
          Duplicate
        </button>
        <button
          type="button"
          className="adm-btn adm-btn-danger"
          disabled={!meta.deletable}
          title={meta.deletable ? undefined : "This block is required on this page"}
          onClick={onDelete}
        >
          Delete
        </button>
        <button type="button" className="adm-btn adm-btn-ghost" aria-expanded={expanded} onClick={onToggle}>
          {expanded ? "Close" : "Edit"}
        </button>
      </div>
      {expanded ? (
        <div className="lay-block-body">
          {meta.hint ? <p className="adm-field-help">{meta.hint}</p> : null}
          <TextField label="Name in this list (optional)" value={block.label ?? ""} onChange={(label) => patch({ label })} max={60} />
          <fieldset className="lay-group">
            <legend className="adm-field-label">Shown on</legend>
            <div className="lay-chips" role="radiogroup" aria-label="Devices">
              {DEVICE_CHIPS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={chip === option.id}
                  className={`lay-chip ${chip === option.id ? "is-on" : ""}`}
                  onClick={() => patch({ devices: option.id === "both" ? [] : [option.id] })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="lay-group">
            <legend className="adm-field-label">Schedule (optional)</legend>
            <div className="lay-dates">
              <label className="adm-field">
                <span className="adm-field-label">Show from</span>
                <input type="datetime-local" className="adm-input" value={isoToLocal(block.startsAt)} onChange={(event) => patch({ startsAt: localToIso(event.target.value) })} />
              </label>
              <label className="adm-field">
                <span className="adm-field-label">Hide after</span>
                <input type="datetime-local" className="adm-input" value={isoToLocal(block.endsAt)} onChange={(event) => patch({ endsAt: localToIso(event.target.value) })} />
              </label>
            </div>
          </fieldset>
          <FieldsForm fields={meta.fields} value={block.props} onChange={(props) => patch({ props })} />
        </div>
      ) : null}
    </li>
  );
}
