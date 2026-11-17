"use client";

import { GripVertical, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { undoAction } from "@/app/admin/undo-actions";
import { Badge } from "@/components/admin/ui/Badge";
import { Button } from "@/components/admin/ui/Button";
import { MoveButtons } from "@/components/admin/ui/MoveButtons";
import { Notice } from "@/components/admin/ui/Notice";
import { Skeleton } from "@/components/admin/ui/Skeleton";
import { TextField } from "@/components/admin/ui/TextField";
import { ToastProvider, useToast } from "@/components/admin/ui/Toast";
import { Toggle } from "@/components/admin/ui/Toggle";
import { useDragRows } from "@/components/admin/layout-editor/useDragRows";
import type { HomeBuilderState } from "@/server/layout/home-builder";
import type { BlockBase } from "@/server/models/layout";
import { loadHomeAction, publishHomeAction, restoreHomeAction, saveHomeDraftAction } from "./actions";
import { AdsSlots } from "./AdsSlots";
import { BannerFields } from "./BannerFields";
import { CategoriesFields, PostsFields, StepsFields, TrustFields } from "./BlockFields";
import { agoLabel, BLOCK_TYPES, changeCount, moveBlock, nameOf, newBlock, problemsOf, stable, summaryOf, withProps, withVisible, type Props } from "./model";
import { Preview, type Device } from "./Preview";
import { Versions } from "./Versions";
import "./builder.css";

const AUTOSAVE_MS = 10_000;

function serialize(blocks: readonly BlockBase[]) {
  return blocks.map((block) => ({
    ...(block.id.startsWith("new-") ? {} : { id: block.id }),
    type: block.type,
    visible: block.visible,
    startsAt: block.startsAt ?? null,
    endsAt: block.endsAt ?? null,
    props: block.props,
  }));
}

function Inner() {
  const toast = useToast();
  const [state, setState] = useState<HomeBuilderState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [blocks, setBlocks] = useState<BlockBase[]>([]);
  const [base, setBase] = useState<BlockBase[]>([]);
  const [slots, setSlots] = useState<HomeBuilderState["slots"]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [note, setNote] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [device, setDevice] = useState<Device>("laptop");
  const [frame, setFrame] = useState(0);
  const [message, setMessage] = useState("");
  const [adding, setAdding] = useState("");

  const load = useCallback(async () => {
    const res = await loadHomeAction();
    if (!res.ok) {
      setLoadError(res.error);
      return;
    }
    setLoadError("");
    setState(res.state);
    setBlocks(res.state.blocks);
    setBase(res.state.blocks);
    setSlots(res.state.slots);
    setSavedAt(res.state.draftSavedAt ? Date.parse(res.state.draftSavedAt) : null);
    setFrame((value) => value + 1);
  }, []);

  useEffect(() => {
    // Loading from the server on mount: the state arrives after the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const dirty = stable(blocks) !== stable(base);
  const problems = useMemo(() => problemsOf(blocks), [blocks]);
  const changes = changeCount(base, blocks);
  const live = state?.liveVersion ?? 0;

  const latest = useRef({ blocks, dirty, busy, problems, publishing });
  useEffect(() => {
    latest.current = { blocks, dirty, busy, problems, publishing };
  });

  const save = useCallback(async (auto: boolean): Promise<boolean> => {
    const now = latest.current;
    if (now.problems.length > 0) {
      if (!auto) {
        setTried(true);
        setMessage(`Fix ${now.problems.length === 1 ? "1 field" : `${now.problems.length} fields`} before saving: ${now.problems[0].message}`);
      }
      return false;
    }
    setBusy(true);
    const res = await saveHomeDraftAction(serialize(now.blocks));
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error);
      if (!auto) toast.show({ kind: "error", message: res.error });
      return false;
    }
    setBlocks(res.blocks);
    setBase(res.blocks);
    setSavedAt(Date.parse(res.savedAt));
    setFrame((value) => value + 1);
    setMessage("");
    setState((current) => (current ? { ...current, starter: false } : current));
    return true;
  }, [toast]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
      const current = latest.current;
      if (current.dirty && !current.busy && !current.publishing && current.problems.length === 0) void save(true);
    }, AUTOSAVE_MS);
    return () => window.clearInterval(timer);
  }, [save]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setPublishing(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const move = (from: number, to: number) => setBlocks((current) => moveBlock(current, from, to));
  const drag = useDragRows(move);
  const change = (id: string) => (patch: Props) => setBlocks((current) => withProps(current, id, patch));

  async function publish() {
    if (busy) return;
    setPublishing(false);
    if (dirty && !(await save(false))) return;
    if (problemsOf(latest.current.blocks).length > 0) return;
    setBusy(true);
    const res = await publishHomeAction(note);
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error);
      toast.show({ kind: "error", message: res.error });
      return;
    }
    setNote("");
    await load();
    const text = `Published as version ${res.version}.`;
    if (res.canUndo && res.eventId) {
      toast.show({
        kind: "undo",
        message: text,
        onUndo: async () => {
          const undone = await undoAction(res.eventId);
          toast.show(undone.ok ? { kind: "success", message: "The previous version is live again." } : { kind: "error", message: undone.message });
          await load();
        },
      });
    } else toast.show({ kind: "success", message: text });
  }

  async function restore(version: number) {
    if (busy) return;
    setBusy(true);
    const res = await restoreHomeAction(version);
    setBusy(false);
    if (!res.ok) {
      toast.show({ kind: "error", message: res.error });
      return;
    }
    setBlocks(res.blocks);
    setBase(res.blocks);
    setFrame((value) => value + 1);
    toast.show({ kind: "success", message: `Version ${version} is in the draft. Publish it to make it live.` });
  }

  if (loadError) {
    return (
      <div className="adm-pb-stack">
        <Notice kind="error">{loadError}</Notice>
        <Button onClick={() => void load()}>Try again</Button>
      </div>
    );
  }
  if (!state) return <Skeleton lines={8} />;

  const present = new Set(blocks.map((block) => block.type));
  const missing = BLOCK_TYPES.filter((type) => !present.has(type));
  const target = adding && missing.includes(adding) ? adding : missing[0];
  const savedLabel = savedAt ? `Draft saved ${agoLabel(savedAt, now)}` : state.starter ? "Starting from today's Home page" : "No draft saved yet";
  const fieldsFor = (block: BlockBase) => {
    const props = { block, problems, onChange: change(block.id) };
    if (block.type === "homeBanner") return <BannerFields {...props} />;
    if (block.type === "homeCategories") return <CategoriesFields {...props} />;
    if (block.type === "homeSteps") return <StepsFields {...props} />;
    if (block.type === "homeTrust") return <TrustFields {...props} />;
    if (block.type === "latestPosts") return <PostsFields {...props} />;
    if (block.type === "homeAds") {
      const adsProps = block.props as Props;
      return (
        <div className="adm-pb-fields" data-tk="ads-fields">
          <TextField label="Small line above the title (optional)" max={60} value={String(adsProps.eyebrow ?? "")} onChange={(eyebrow) => change(block.id)({ eyebrow })} />
          <TextField label="Title above the ads" required max={120} value={String(adsProps.title ?? "")} error={problems.find((item) => item.blockId === block.id && item.field === "title")?.message} help="{city} becomes the visitor's city." onChange={(title) => change(block.id)({ title })} />
          <TextField label="Link text to all ads (optional)" max={60} value={String(adsProps.moreText ?? "")} onChange={(moreText) => change(block.id)({ moreText })} />
          <AdsSlots slots={slots} onSlots={setSlots} />
        </div>
      );
    }
    return null;
  };

  return (
    <div className="adm-pb" data-tk="home-builder" data-dirty={dirty ? "yes" : "no"}>
      <div className="adm-pb-status" data-tk="builder-status">
        <Badge tone={live > 0 ? "ok" : "neutral"} dot>{live > 0 ? `Live: version ${live}` : "Nothing published from here yet"}</Badge>
        {changes > 0 ? <Badge tone="warn" dot>{`Draft: ${changes} ${changes === 1 ? "change" : "changes"}`}</Badge> : null}
      </div>
      {!state.switchOn ? (
        <Notice kind="info" title="Visitors still see today's Home page.">
          The switch that draws Home from this page is off, so publishing here does not change what visitors see yet. You can edit, preview and publish safely.
        </Notice>
      ) : null}
      {message ? <Notice kind="error">{message}</Notice> : null}

      <div className="adm-pb-grid">
        <section className="adm-card adm-pb-card adm-pb-blocks" aria-labelledby="pb-blocks">
          <header className="adm-pb-head">
            <h2 id="pb-blocks">Blocks on Home</h2>
          </header>
          <ul className="adm-pb-blocklist" data-tk="block-list">
            {blocks.map((block, index) => (
              <li key={block.id} className={`adm-pb-blockrow${drag.over === index ? " is-over" : ""}${block.visible ? "" : " is-off"}`} data-drag-row data-tk={`block-row-${block.type}`} {...drag.rowProps(index)}>
                <span className="adm-pb-grip" aria-hidden="true" {...drag.handleProps(index)}><GripVertical size={16} /></span>
                <a className="adm-pb-blockname" href={`#pb-card-${block.id}`}>
                  <strong>{nameOf(block)}</strong>
                  <small>{summaryOf(block, slots.length)}</small>
                </a>
                <MoveButtons name={nameOf(block)} canUp={index > 0} canDown={index < blocks.length - 1} onUp={() => move(index, index - 1)} onDown={() => move(index, index + 1)} />
                <Toggle checked={block.visible} onChange={(visible) => setBlocks((current) => withVisible(current, block.id, visible))} label={`Show ${nameOf(block)}`} />
              </li>
            ))}
          </ul>
          {missing.length > 0 ? (
            <div className="adm-pb-add">
              <label className="adm-field">
                <span className="adm-field-label">Add block</span>
                <select className="adm-input" value={target} onChange={(event) => setAdding(event.target.value)}>
                  {missing.map((type) => (
                    <option key={type} value={type}>{nameOf({ type })}</option>
                  ))}
                </select>
              </label>
              <Button icon={Plus} onClick={() => { const added = newBlock(target, new Set(blocks.map((block) => block.id))); setBlocks((current) => [...current, added]); }}>
                Add block
              </Button>
            </div>
          ) : null}
          <p className="adm-pb-note">Words inside a block are edited here. Shared labels (buttons, form errors, menus) are in Menus &amp; site text.</p>
        </section>

        <div className="adm-pb-main">
          {blocks.map((block) => (
            <section key={block.id} id={`pb-card-${block.id}`} className="adm-card adm-pb-card" aria-labelledby={`pb-h-${block.id}`} data-tk={`block-card-${block.type}`}>
              <header className="adm-pb-head">
                <h2 id={`pb-h-${block.id}`}>{nameOf(block)}</h2>
                <Badge tone={block.visible ? "ok" : "neutral"}>{block.visible ? "Shown" : "Hidden"}</Badge>
              </header>
              <div className="adm-pb-body">{fieldsFor(block)}</div>
            </section>
          ))}
        </div>

        <aside className="adm-pb-side" aria-label="Preview and versions">
          <section className="adm-card adm-pb-card" aria-labelledby="pb-preview">
            <header className="adm-pb-head">
              <h2 id="pb-preview">Preview</h2>
              <span className="adm-pb-devices" role="group" aria-label="Preview size">
                {(["laptop", "phone"] as const).map((key) => (
                  <button key={key} type="button" className="adm-pb-device" aria-pressed={device === key} onClick={() => setDevice(key)}>
                    {key === "laptop" ? "Laptop" : "Phone"}
                  </button>
                ))}
              </span>
            </header>
            <Preview device={device} version={live} reloadKey={frame} />
          </section>
          <Versions state={state} busy={busy} onRestore={(version) => void restore(version)} />
        </aside>
      </div>

      <div className="adm-k-savebar" role="region" aria-label="Save changes" data-tk="save-bar" data-dirty={dirty ? "yes" : "no"}>
        <span className={`adm-k-savedot${dirty ? " is-dirty" : ""}`} aria-hidden="true" />
        <span className="adm-k-savetext" aria-live="polite">
          <strong>{savedLabel}</strong> <span>{dirty ? `${changes} ${changes === 1 ? "change" : "changes"} not saved` : changes === 0 && live > 0 ? "" : ""}</span>
        </span>
        <span className="adm-k-sp" />
        <Button kind="quiet" disabled={!dirty || busy} onClick={() => { setBlocks(base); setTried(false); setMessage(""); }}>Discard</Button>
        <Button disabled={!dirty || busy} onClick={() => void save(false)}>Save draft</Button>
        <Button kind="primary" busy={busy} onClick={() => (dirty && problems.length > 0 ? void save(false) : setPublishing(true))}>Publish</Button>
      </div>
      {tried && problems.length > 0 ? <p className="adm-k-err" role="alert" data-tk="problems">{problems.length === 1 ? "1 field needs attention." : `${problems.length} fields need attention.`}</p> : null}

      {publishing ? (
        <div className="adm-dialog-back" onClick={() => setPublishing(false)}>
          <div className="adm-dialog" role="dialog" aria-modal="true" aria-label="Publish the Home page" data-tk="publish-dialog" onClick={(event) => event.stopPropagation()}>
            <h2>Publish the Home page?</h2>
            <p>{dirty ? "Your unsaved changes are saved first, then this becomes the next version." : "The saved draft becomes the next version."} You can undo it for a while.</p>
            <TextField label="Note (optional)" value={note} onChange={setNote} max={200} help="Shown next to the version so you remember what changed." />
            <div className="adm-dialog-actions">
              <Button kind="quiet" onClick={() => setPublishing(false)}>Cancel</Button>
              <Button kind="primary" disabled={busy} onClick={() => void publish()}>Publish now</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function HomeBuilder() {
  return (
    <ToastProvider>
      <Inner />
    </ToastProvider>
  );
}
