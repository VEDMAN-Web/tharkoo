"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadLayout, publishAction, restoreAction, saveDraftAction } from "@/app/admin/layout-actions";
import type { BlockBase, PageKey } from "@/server/models/layout";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { EmptyState } from "../ui/EmptyState";
import { Notice } from "../ui/Notice";
import { SaveBar } from "../ui/SaveBar";
import { reorder } from "../ui/SortableList";
import { Skeleton } from "../ui/Skeleton";
import { TextField } from "../ui/TextField";
import { BlockCard, blockTitle, type BlockDraft } from "./BlockCard";
import { cleanProps, metaFor } from "./fields";
import { RevisionsDrawer } from "./RevisionsDrawer";
import { useDragRows } from "./useDragRows";
import "./layout-editor.css";

interface Row {
  key: string;
  block: BlockDraft;
}

interface Loaded {
  rows: Row[];
  /** JSON of the draft as the server holds it. */
  saved: string;
  /** JSON of the live version, or null when nothing was published yet. */
  published: string | null;
}

type Msg = { kind: "info" | "error"; text: string } | null;

const toDraft = (block: BlockBase): BlockDraft => ({
  id: block.id,
  type: block.type,
  visible: block.visible !== false,
  label: block.label,
  devices: block.devices,
  startsAt: block.startsAt ?? null,
  endsAt: block.endsAt ?? null,
  props: block.props ?? {},
});

/** What is sent to the server (and what is compared to find unsaved changes). */
function serialize(blocks: readonly BlockDraft[]) {
  return blocks.map((block) => ({
    ...(block.id ? { id: block.id } : {}),
    type: block.type,
    visible: block.visible,
    ...(block.label?.trim() ? { label: block.label.trim() } : {}),
    ...(block.devices?.length ? { devices: block.devices } : {}),
    startsAt: block.startsAt || null,
    endsAt: block.endsAt || null,
    props: cleanProps(metaFor(block.type).fields, block.props),
  }));
}

const jsonOf = (blocks: readonly BlockDraft[]) => JSON.stringify(serialize(blocks));

export function LayoutEditor({
  pageKey,
  scope,
  allowedTypes,
  previewHref,
  seoHref,
}: {
  pageKey: PageKey;
  scope: string;
  allowedTypes: string[];
  previewHref: string;
  seoHref?: string;
}) {
  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [addType, setAddType] = useState(allowedTypes[0] ?? "");
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [showRevisions, setShowRevisions] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [note, setNote] = useState("");
  const counter = useRef(0);
  const nextKey = useCallback(() => `b${++counter.current}`, []);

  const makeRows = useCallback((blocks: readonly BlockBase[], keys?: readonly string[]): Row[] => blocks.map((block, index) => ({ key: keys?.[index] ?? nextKey(), block: toDraft(block) })), [nextKey]);

  const load = useCallback(async () => {
    setLoadError("");
    const res = await loadLayout(pageKey, scope);
    if (!res.ok) {
      setLoadError(res.error);
      return;
    }
    const rows = makeRows(res.draft);
    setData({
      rows,
      saved: jsonOf(rows.map((row) => row.block)),
      published: res.published ? jsonOf(res.published.map(toDraft)) : null,
    });
  }, [pageKey, scope, makeRows]);

  useEffect(() => {
    // Loading from the server on mount: the state update arrives after the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const dirty = data ? jsonOf(rows.map((row) => row.block)) !== data.saved : false;

  /* Warn before leaving with unsaved changes (reload, close tab, or a link inside the admin). */
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
      if (!window.confirm("You have unsaved changes. Leave this page and lose them?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const setRows = (change: (current: Row[]) => Row[]) => setData((current) => (current ? { ...current, rows: change(current.rows) } : current));
  const move = (from: number, to: number) => setRows((current) => reorder(current, from, to));
  const drag = useDragRows(move);

  const countOf = (type: string) => rows.filter((row) => row.block.type === type).length;
  const isFull = (type: string) => {
    const max = metaFor(type).max;
    return max !== undefined && countOf(type) >= max;
  };

  // The default choice is the first type that is not already on the page (a single-instance type stays disabled once it is there).
  const selectedAdd = addType && !isFull(addType) ? addType : (allowedTypes.find((type) => !isFull(type)) ?? "");

  function addBlock() {
    if (!selectedAdd) return;
    const row: Row = { key: nextKey(), block: { type: selectedAdd, visible: true, startsAt: null, endsAt: null, props: { ...metaFor(selectedAdd).defaults } } };
    setRows((current) => [...current, row]);
    setOpen(row.key);
    setMsg({ kind: "info", text: `${metaFor(selectedAdd).label} added at the bottom. Edit it, then save the draft.` });
  }

  function duplicate(row: Row) {
    if (isFull(row.block.type)) return;
    const { id: _ignored, ...rest } = row.block;
    void _ignored;
    const copy: Row = { key: nextKey(), block: { ...rest, props: structuredClone(row.block.props) } };
    setRows((current) => {
      const at = current.findIndex((item) => item.key === row.key);
      return [...current.slice(0, at + 1), copy, ...current.slice(at + 1)];
    });
    setOpen(copy.key);
    setMsg({ kind: "info", text: "Block copied just below the original. Save the draft to keep it." });
  }

  function remove(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
    setOpen((current) => (current === key ? null : current));
    setDeleteKey(null);
    setMsg({ kind: "info", text: "Block removed from the draft. Save the draft to keep this change." });
  }

  /** Saves the draft; returns the JSON now stored on the server, or null when it failed. */
  async function save(): Promise<string | null> {
    const res = await saveDraftAction(pageKey, scope, serialize(rows.map((row) => row.block)));
    if (!res.ok) {
      setMsg({ kind: "error", text: res.error });
      return null;
    }
    const keys = rows.map((row) => row.key);
    const next = makeRows(res.blocks, keys);
    const json = jsonOf(next.map((row) => row.block));
    setData((current) => (current ? { ...current, rows: next, saved: json } : current));
    return json;
  }

  async function guarded(job: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await job();
    } catch {
      setMsg({ kind: "error", text: "Could not reach the server. Nothing was changed. Try again." });
    } finally {
      setBusy(false);
    }
  }

  const saveDraft = () =>
    guarded(async () => {
      if (await save()) setMsg({ kind: "info", text: "Draft saved. Visitors do not see it until you publish." });
    });

  const preview = () =>
    guarded(async () => {
      const win = window.open("about:blank", "_blank");
      if (dirty && !(await save())) {
        win?.close();
        return;
      }
      if (win) win.location.href = previewHref;
      else window.open(previewHref, "_blank");
      setMsg({ kind: "info", text: "Preview opened in a new tab. It shows the saved draft, not the live page." });
    });

  const publish = () =>
    guarded(async () => {
      setPublishing(false);
      const json = dirty ? await save() : data?.saved ?? null;
      if (json === null) return;
      const res = await publishAction(pageKey, scope, note.trim() || undefined);
      if (!res.ok) {
        setMsg({ kind: "error", text: res.error });
        return;
      }
      setNote("");
      setData((current) => (current ? { ...current, published: json } : current));
      setMsg({ kind: "info", text: `Published as version ${res.version}. The live page updates within a few seconds.` });
    });

  const restore = (version: number) =>
    guarded(async () => {
      const res = await restoreAction(pageKey, scope, version);
      if (!res.ok) {
        setMsg({ kind: "error", text: res.error });
        return;
      }
      const next = makeRows(res.blocks);
      setData((current) => (current ? { ...current, rows: next, saved: jsonOf(next.map((row) => row.block)) } : current));
      setOpen(null);
      setShowRevisions(false);
      setMsg({ kind: "info", text: `Version ${version} restored into the draft. Publish it to put it on the live page.` });
    });

  if (loadError) {
    return (
      <div className="adm-stack">
        <Notice kind="error">{loadError}</Notice>
        <button type="button" className="adm-btn adm-btn-quiet" onClick={() => void load()}>Try again</button>
      </div>
    );
  }
  if (!data) return <Skeleton lines={6} />;

  const state = data.published === null ? "Not published yet" : data.published === data.saved ? "Live page matches the saved draft" : "Saved draft has changes that are not live yet";
  const deleting = rows.find((row) => row.key === deleteKey);

  return (
    <div className="lay">
      <div className="lay-toolbar">
        <span className="lay-state" aria-live="polite">{state}</span>
        <button type="button" className="adm-btn adm-btn-quiet" onClick={() => setShowRevisions(true)}>Revisions</button>
        {seoHref ? <Link href={seoHref} className="adm-link-plain">Edit SEO title &amp; description</Link> : null}
      </div>

      {msg ? <div className="lay-msg"><Notice kind={msg.kind}>{msg.text}</Notice></div> : null}

      {rows.length === 0 ? (
        <EmptyState title="No blocks yet" why="Pick a block type below and press Add block. The page shows its built-in content until a layout is published." />
      ) : (
        <ul className="lay-list" aria-label="Blocks on this page">
          {rows.map((row, index) => (
            <BlockCard
              key={row.key}
              block={row.block}
              index={index}
              count={rows.length}
              expanded={open === row.key}
              isOver={drag.over === index}
              atMax={isFull(row.block.type)}
              onToggle={() => setOpen(open === row.key ? null : row.key)}
              onChange={(block) => setRows((current) => current.map((item) => (item.key === row.key ? { ...item, block } : item)))}
              onMove={(to) => move(index, to)}
              onDuplicate={() => duplicate(row)}
              onDelete={() => setDeleteKey(row.key)}
              dragHandle={drag.handleProps(index)}
              dropProps={drag.rowProps(index)}
            />
          ))}
        </ul>
      )}

      <div className="lay-add">
        <label className="adm-field">
          <span className="adm-field-label">Add block</span>
          <select className="adm-input" value={selectedAdd} onChange={(event) => setAddType(event.target.value)}>
            {allowedTypes.map((type) => (
              <option key={type} value={type} disabled={isFull(type)}>
                {metaFor(type).label}{isFull(type) ? " (already on the page)" : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="adm-btn" disabled={!selectedAdd} onClick={addBlock}>Add block</button>
      </div>

      <SaveBar dirty={dirty} busy={busy} onSaveDraft={() => void saveDraft()} onPreview={() => void preview()} onPublish={() => setPublishing(true)} />

      <ConfirmDialog
        open={deleting !== undefined}
        title={`Delete ${deleting ? blockTitle(deleting.block) : "block"}?`}
        body="It leaves the draft now. The live page keeps it until you save and publish."
        confirmText="delete"
        onConfirm={() => deleteKey && remove(deleteKey)}
        onCancel={() => setDeleteKey(null)}
      />

      {publishing ? (
        <div className="adm-dialog-back" onClick={() => setPublishing(false)}>
          <div className="adm-dialog" role="dialog" aria-modal="true" aria-label="Publish" onClick={(event) => event.stopPropagation()}>
            <h2>Publish this page?</h2>
            <p>{dirty ? "Your unsaved changes are saved first, then the layout goes live." : "The saved draft goes live."}</p>
            <TextField label="Note (optional)" value={note} onChange={setNote} max={200} help="Shown in Revisions so you remember what changed." />
            <div className="adm-dialog-actions">
              <button type="button" className="adm-btn adm-btn-quiet" onClick={() => setPublishing(false)}>Cancel</button>
              <button type="button" className="adm-btn" disabled={busy} onClick={() => void publish()}>Publish now</button>
            </div>
          </div>
        </div>
      ) : null}

      {showRevisions ? (
        <RevisionsDrawer pageKey={pageKey} scope={scope} dirty={dirty} busy={busy} onRestore={(version) => void restore(version)} onClose={() => setShowRevisions(false)} />
      ) : null}
    </div>
  );
}
