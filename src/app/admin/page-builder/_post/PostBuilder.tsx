"use client";

import { Eye, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { undoAction } from "@/app/admin/undo-actions";
import { Badge } from "@/components/admin/ui/Badge";
import { Button } from "@/components/admin/ui/Button";
import { Notice } from "@/components/admin/ui/Notice";
import { Skeleton } from "@/components/admin/ui/Skeleton";
import { TextField } from "@/components/admin/ui/TextField";
import { ToastProvider, useToast } from "@/components/admin/ui/Toast";
import { Toggle } from "@/components/admin/ui/Toggle";
import type { PostBuilderState } from "@/server/layout/post-builder";
import type { BlockBase } from "@/server/models/layout";
import { agoLabel } from "../_home/model";
import { Versions } from "../_home/Versions";
import { IntroFields, PhotoRulesFields, PromotionFields, StepFields, SuccessFields, TextsFields } from "./Fields";
import { ADDABLE, canHide, changeCount, isTextsBlock, nameOf, newBlock, problemsOf, stable, summaryOf, withProps, withVisible, type Props } from "./model";
import { loadPostAction, publishPostAction, restorePostAction, savePostDraftAction } from "./actions";
import "../_home/builder.css";
import "./post-builder.css";

const AUTOSAVE_MS = 10_000;
const PREVIEW_HREF = "/u/post-insert/?preview=1";

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
  const [state, setState] = useState<PostBuilderState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [blocks, setBlocks] = useState<BlockBase[]>([]);
  const [base, setBase] = useState<BlockBase[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [note, setNote] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [adding, setAdding] = useState("");

  const load = useCallback(async () => {
    const res = await loadPostAction();
    if (!res.ok) {
      setLoadError(res.error);
      return;
    }
    setLoadError("");
    setState(res.state);
    setBlocks(res.state.blocks);
    setBase(res.state.blocks);
    setSavedAt(res.state.draftSavedAt ? Date.parse(res.state.draftSavedAt) : null);
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
    const current = latest.current;
    if (current.problems.length > 0) {
      if (!auto) {
        setTried(true);
        setMessage(`Fix ${current.problems.length === 1 ? "1 field" : `${current.problems.length} fields`} before saving: ${current.problems[0].message}`);
      }
      return false;
    }
    setBusy(true);
    const res = await savePostDraftAction(serialize(current.blocks));
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error);
      if (!auto) toast.show({ kind: "error", message: res.error });
      return false;
    }
    setBlocks(res.blocks);
    setBase(res.blocks);
    setSavedAt(Date.parse(res.savedAt));
    setMessage("");
    setState((value) => (value ? { ...value, starter: false } : value));
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

  const change = (id: string) => (patch: Props) => setBlocks((current) => withProps(current, id, patch));

  async function publish() {
    if (busy) return;
    setPublishing(false);
    if (dirty && !(await save(false))) return;
    if (problemsOf(latest.current.blocks).length > 0) return;
    setBusy(true);
    const res = await publishPostAction(note);
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
    const res = await restorePostAction(version);
    setBusy(false);
    if (!res.ok) {
      toast.show({ kind: "error", message: res.error });
      return;
    }
    setBlocks(res.blocks);
    setBase(res.blocks);
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
  const missing = ADDABLE.filter((type) => !present.has(type));
  const target = adding && missing.includes(adding) ? adding : missing[0];
  const savedLabel = savedAt ? `Draft saved ${agoLabel(savedAt, now)}` : state.starter ? "Starting from today's wording" : "No draft saved yet";
  const fieldsFor = (block: BlockBase) => {
    const props = { block, problems, fee: state.fee, onChange: change(block.id) };
    if (block.type === "postStep") return <StepFields {...props} />;
    if (block.type === "postIntro") return <IntroFields {...props} />;
    if (block.type === "photoRules") return <PhotoRulesFields {...props} />;
    if (block.type === "promotionPicker") return <PromotionFields {...props} />;
    if (block.type === "postSuccess") return <SuccessFields {...props} />;
    if (isTextsBlock(block.type)) return <TextsFields {...props} />;
    return null;
  };

  return (
    <div className="adm-pb" data-tk="post-builder" data-dirty={dirty ? "yes" : "no"}>
      <div className="adm-pb-status" data-tk="builder-status">
        <Badge tone={live > 0 ? "ok" : "neutral"} dot>{live > 0 ? `Live: version ${live}` : "Nothing published from here yet"}</Badge>
        {changes > 0 ? <Badge tone="warn" dot>{`Draft: ${changes} ${changes === 1 ? "change" : "changes"}`}</Badge> : null}
        <Button href={PREVIEW_HREF} target="_blank" rel="noopener" icon={Eye} size="sm" className="adm-pb-previewlink">Preview the saved draft</Button>
      </div>
      {message ? <Notice kind="error">{message}</Notice> : null}

      <div className="adm-pb-grid adm-pb-grid-2">
        <section className="adm-card adm-pb-card adm-pb-blocks" aria-labelledby="pb-blocks">
          <header className="adm-pb-head">
            <h2 id="pb-blocks">Parts of the Post-ad page</h2>
          </header>
          <ul className="adm-pb-blocklist" data-tk="block-list">
            {blocks.map((block) => (
              <li key={block.id} className={`adm-pb-blockrow${block.visible ? "" : " is-off"}`} data-tk={`block-row-${block.type}`}>
                <a className="adm-pb-blockname" href={`#pb-card-${block.id}`}>
                  <strong>{nameOf(block)}</strong>
                  <small>{summaryOf(block)}</small>
                </a>
                {canHide(block) ? (
                  <Toggle checked={block.visible} onChange={(visible) => setBlocks((current) => withVisible(current, block.id, visible))} label={`Show ${nameOf(block)}`} />
                ) : (
                  <Badge>Always on</Badge>
                )}
              </li>
            ))}
          </ul>
          {missing.length > 0 ? (
            <div className="adm-pb-add">
              <label className="adm-field">
                <span className="adm-field-label">Add part</span>
                <select className="adm-input" value={target} onChange={(event) => setAdding(event.target.value)}>
                  {missing.map((type) => (
                    <option key={type} value={type}>{nameOf({ type, props: {} })}</option>
                  ))}
                </select>
              </label>
              <Button icon={Plus} onClick={() => setBlocks((current) => [...current, newBlock(target, new Set(current.map((block) => block.id)))])}>Add part</Button>
            </div>
          ) : null}
          <p className="adm-pb-note">The steps stay in this order and cannot be removed. Shared labels (buttons, errors, field names) are in Menus &amp; site text.</p>
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

        <aside className="adm-pb-side" aria-label="Versions">
          <Versions state={state} busy={busy} onRestore={(version) => void restore(version)} />
        </aside>
      </div>

      <div className="adm-k-savebar adm-pb-savebar" role="region" aria-label="Save changes" data-tk="save-bar" data-dirty={dirty ? "yes" : "no"}>
        <span className={`adm-k-savedot${dirty ? " is-dirty" : ""}`} aria-hidden="true" />
        <span className="adm-k-savetext" aria-live="polite">
          <strong>{savedLabel}</strong> <span>{dirty ? `${changes} ${changes === 1 ? "change" : "changes"} not saved` : ""}</span>
        </span>
        <span className="adm-k-sp" />
        <Button kind="quiet" disabled={!dirty || busy} onClick={() => { setBlocks(base); setTried(false); setMessage(""); }}>Discard</Button>
        <Button disabled={!dirty || busy} onClick={() => void save(false)}>Save draft</Button>
        <Button kind="primary" busy={busy} onClick={() => (dirty && problems.length > 0 ? void save(false) : setPublishing(true))}>Publish</Button>
      </div>
      {tried && problems.length > 0 ? <p className="adm-k-err" role="alert" data-tk="problems">{problems.length === 1 ? "1 field needs attention." : `${problems.length} fields need attention.`}</p> : null}

      {publishing ? (
        <div className="adm-dialog-back" onClick={() => setPublishing(false)}>
          <div className="adm-dialog" role="dialog" aria-modal="true" aria-label="Publish the Post-ad page" data-tk="publish-dialog" onClick={(event) => event.stopPropagation()}>
            <h2>Publish the Post-ad page?</h2>
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

export function PostBuilder() {
  return (
    <ToastProvider>
      <Inner />
    </ToastProvider>
  );
}
