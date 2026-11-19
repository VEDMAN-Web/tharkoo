"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Save, Send } from "lucide-react";
import { undoAction } from "@/app/admin/undo-actions";
import { Badge, Button, ReasonDialog, useToast, type BadgeTone } from "@/components/admin/ui";
import { ImagePicker } from "@/components/admin/ui/ImagePicker";
import { RichBody } from "@/components/content/RichBody";
import type { ContentStatus } from "@/server/models/content";
import type { EditorItem, Option } from "@/server/content/studio/admin";
import type { LinkSuggestion } from "@/server/content/studio/suggest";
import { changeSlugAction, publishAction, saveDraftAction, unpublishAction } from "../actions";
import { BodyEditor, type MediaMap } from "./BodyEditor";
import { SeoPanel } from "./SeoPanel";
import { Suggestions } from "./Suggestions";
import { EXCERPT_MAX, TITLE_MAX, bodyText, buildFields, sameState, toEditorState, type EditorState } from "./data";
import { linkInBody } from "./links";

const AUTOSAVE_MS = 10_000;
const TICK_MS = 5_000;
const STEPS: { key: ContentStatus; label: string; tone: BadgeTone }[] = [
  { key: "draft", label: "Draft", tone: "ok" },
  { key: "review", label: "In review", tone: "pri" },
  { key: "scheduled", label: "Scheduled", tone: "neutral" },
  { key: "published", label: "Published", tone: "neutral" },
];
const OFF_REASONS = ["Send visitors to the list page", "Say the page is gone"] as const;

const IST = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

function agoText(from: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - from) / 1000));
  if (seconds < 60) return `${Math.floor(seconds / 5) * 5 || 0} s ago`;
  return `${Math.round(seconds / 60)} min ago`;
}

type Problem = { message: string; fields: string[] };

function Counter({ length, max }: { length: number; max: number }) {
  return <span className={`adm-k-count${length > max ? " is-long" : ""}`}>{length} / {max}</span>;
}

/** The editor of one blog post or help article (H8.31): fields, text blocks, cover, autosave every 10 s, Save draft, Publish. */
export function Editor({ item, authors, categories, host, prefix, canPublish, canWrite }: { item: EditorItem; authors: Option[]; categories: Option[]; host: string; prefix: string; canPublish: boolean; canWrite: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<EditorState>(() => toEditorState(item.fields as unknown as Record<string, unknown>));
  const [saved, setSaved] = useState<EditorState>(state);
  const [media, setMedia] = useState<MediaMap>(item.media);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<"" | "save" | "publish">("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [preview, setPreview] = useState(false);
  const [off, setOff] = useState(false);
  const latest = useRef({ state, saved, busy });
  useEffect(() => {
    latest.current = { state, saved, busy };
  });
  const dirty = !sameState(state, saved);
  const editable = canWrite;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const save = useCallback(
    async (quiet: boolean): Promise<boolean> => {
      const sending = latest.current.state;
      setBusy("save");
      const result = await saveDraftAction({ itemId: item.id, fields: buildFields(item.fields as unknown as Record<string, unknown>, sending), expectedVersion: item.version });
      setBusy("");
      if (!result.ok) {
        setProblem({ message: result.message, fields: Object.entries(result.fields ?? {}).flatMap(([key, list]) => list.map((text) => `${key}: ${text}`)) });
        return false;
      }
      setProblem(null);
      setSaved(sending);
      setSavedAt(Date.now());
      if (!quiet) toast.show({ kind: "success", message: "Draft saved." });
      router.refresh();
      return true;
    },
    [item.id, item.fields, item.version, router, toast],
  );

  useEffect(() => {
    if (!editable || !dirty || busy) return;
    const id = window.setTimeout(() => {
      if (!latest.current.busy && !sameState(latest.current.state, latest.current.saved)) void save(true);
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(id);
  }, [state, dirty, busy, editable, save]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const patch = (change: Partial<EditorState>) => setState((current) => ({ ...current, ...change }));

  async function undoIt(eventId: string, what: string) {
    const outcome = await undoAction(eventId);
    toast.show({ kind: outcome.ok ? "success" : "error", message: outcome.ok ? `${what} undone.` : outcome.message });
    router.refresh();
  }

  async function publish() {
    if (dirty && !(await save(true))) return;
    setBusy("publish");
    const result = await publishAction({ itemId: item.id });
    setBusy("");
    if (!result.ok) {
      setProblem({ message: result.message, fields: Object.entries(result.fields ?? {}).flatMap(([key, list]) => list.map((text) => `${key}: ${text}`)) });
      return;
    }
    toast.show({ kind: "undo", message: result.summary, onUndo: () => void undoIt(result.eventId, "Publishing") });
    router.refresh();
  }

  async function takeOff(choice: string) {
    const gone = choice === OFF_REASONS[1];
    const result = await unpublishAction({ itemId: item.id, mode: gone ? "gone" : "redirect", to: gone ? undefined : `/${prefix}/` });
    if (!result.ok) {
      toast.show({ kind: "error", message: result.message });
      return;
    }
    toast.show({ kind: "undo", message: result.summary, onUndo: () => void undoIt(result.eventId, "Taking it off the site") });
    router.refresh();
  }

  async function changeAddress(next: string): Promise<string | null> {
    const result = await changeSlugAction({ itemId: item.id, slug: next });
    if (!result.ok) return result.message;
    toast.show({ kind: "success", message: result.summary });
    router.refresh();
    return null;
  }

  function addLink(suggestion: LinkSuggestion): boolean {
    const next = linkInBody(state.body.map((entry) => entry.node), suggestion.phrase, suggestion.path);
    if (!next) return false;
    setState((current) => ({ ...current, body: current.body.map((entry, index) => ({ key: entry.key, node: next[index] })) }));
    return true;
  }

  const publicStatus = item.status === "published" || item.status === "scheduled" || Boolean(item.publishedAt);
  const status = item.status;
  const label = dirty ? "Unsaved changes" : savedAt ? `Draft saved ${agoText(savedAt, now)}` : "All changes saved";

  return (
    <div className="adm-st-editor" data-tk="editor">
      <section className="adm-card adm-st-main" aria-label="Editor">
        <div className="adm-st-steps">
          <span className="adm-st-stepbadges" aria-label={`Status: ${status === "unpublished" ? "off the site" : status}`}>
            {status === "unpublished" ? <Badge tone="bad">Off the site</Badge> : STEPS.map((step) => <Badge key={step.key} tone={step.key === status ? step.tone : "neutral"}>{step.label}</Badge>)}
          </span>
          <span className="adm-k-help" role="status" data-tk="save-state">{label}</span>
        </div>
        {item.aiDraft ? <p className="adm-k-note" role="note" data-tk="ai-banner">AI draft - check every fact before publishing</p> : null}
        {problem ? (
          <div className="adm-k-notice-err" role="alert" data-tk="problem" tabIndex={-1}>
            <strong>{problem.message}</strong>
            {problem.fields.length ? <ul>{problem.fields.map((text) => <li key={text}>{text}</li>)}</ul> : null}
          </div>
        ) : null}
        <fieldset className="adm-st-fields" disabled={!editable}>
          <div className="adm-k-field">
            <label className="adm-k-label adm-k-lab" htmlFor="st-title"><span>Title (H1 on the page)<span className="adm-k-req" aria-hidden="true"> *</span></span><Counter length={state.title.length} max={TITLE_MAX} /></label>
            <input id="st-title" className="adm-k-input" required value={state.title} onChange={(event) => patch({ title: event.target.value })} />
          </div>
          <div className="adm-k-field">
            <label className="adm-k-label adm-k-lab" htmlFor="st-excerpt"><span>Short summary</span><Counter length={state.excerpt.length} max={EXCERPT_MAX} /></label>
            <textarea id="st-excerpt" className="adm-k-input" rows={3} value={state.excerpt} onChange={(event) => patch({ excerpt: event.target.value })} />
            <p className="adm-k-help">Shown on the {item.kind === "blog" ? "blog" : "help"} list and when shared.</p>
          </div>
          <div className="adm-k-field">
            <ImagePicker
              label="Cover picture"
              value={state.coverMediaId && media[state.coverMediaId] ? { assetId: state.coverMediaId, src: media[state.coverMediaId].src, alt: media[state.coverMediaId].alt, width: 0, height: 0 } : null}
              onChange={(picked) => {
                if (!picked) return patch({ coverMediaId: "" });
                setMedia((current) => ({ ...current, [picked.assetId]: { src: picked.src, alt: picked.alt } }));
                patch({ coverMediaId: picked.assetId });
              }}
            />
          </div>
          <div className="adm-k-field">
            <div className="adm-st-texthead">
              <span className="adm-k-label" id="st-text-label">Text<span className="adm-k-req" aria-hidden="true"> *</span></span>
              <Button size="sm" icon={preview ? EyeOff : Eye} onClick={() => setPreview((value) => !value)}>{preview ? "Back to editing" : "Preview"}</Button>
            </div>
            {preview ? (
              <article className="adm-st-preview tk-rich-wrap" data-tk="preview" aria-label="Preview of the text">
                <h3>{state.title || "Untitled"}</h3>
                <RichBody body={{ v: 1, nodes: state.body.map((entry) => entry.node) }} media={media} />
              </article>
            ) : (
              <BodyEditor value={state.body} onChange={(body) => patch({ body })} media={media} onMedia={(id, picture) => setMedia((current) => ({ ...current, [id]: picture }))} />
            )}
          </div>
        </fieldset>
        <div className="adm-st-foot">
          {canPublish && publicStatus && status !== "unpublished" ? <Button kind="danger" onClick={() => setOff(true)}>Take off the site...</Button> : null}
          <span className="adm-k-sp" />
          {editable ? (
            <Button icon={Save} busy={busy === "save"} disabled={!dirty || busy !== ""} onClick={() => void save(false)}>Save draft</Button>
          ) : null}
          {canPublish ? (
            <Button kind="primary" icon={Send} busy={busy === "publish"} disabled={busy !== ""} onClick={() => void publish()}>{status === "published" ? "Publish changes" : "Publish"}</Button>
          ) : (
            <p className="adm-k-help adm-st-note" data-tk="no-publish">An editor or admin publishes this. Your draft is saved.</p>
          )}
        </div>
      </section>

      <aside className="adm-st-side" aria-label="Details">
        <section className="adm-card adm-st-card" aria-labelledby="st-pub-h" data-tk="publish-card">
          <div className="adm-st-cardhead">
            <h2 id="st-pub-h">Publish</h2>
            <Badge tone={status === "published" ? "ok" : status === "unpublished" ? "bad" : "info"}>{status === "unpublished" ? "Off the site" : status === "review" ? "In review" : status[0].toUpperCase() + status.slice(1)}</Badge>
          </div>
          <div className="adm-st-cardbody">
            <p className="adm-k-help" data-tk="publish-on">{item.publishedAt ? `Published on ${IST.format(new Date(item.publishedAt))} IST` : item.scheduledAt ? `Scheduled for ${IST.format(new Date(item.scheduledAt))} IST` : "Not published yet. It goes live when you press Publish."}</p>
            {item.kind === "blog" ? (
              <>
                {authors.length ? (
                  <div className="adm-k-field">
                    <label className="adm-k-label" htmlFor="st-author">Author</label>
                    <select id="st-author" className="adm-k-select" value={state.authorId} disabled={!editable} onChange={(event) => patch({ authorId: event.target.value })}>
                      <option value="">No author</option>
                      {authors.map((author) => <option key={author.id} value={author.id}>{author.title}</option>)}
                    </select>
                  </div>
                ) : null}
                {categories.length ? (
                  <div className="adm-k-field">
                    <label className="adm-k-label" htmlFor="st-category">Category</label>
                    <select id="st-category" className="adm-k-select" value={state.categoryId} disabled={!editable} onChange={(event) => patch({ categoryId: event.target.value })}>
                      <option value="">No category</option>
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}
                    </select>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="adm-k-field">
                <label className="adm-k-label" htmlFor="st-section">Help section</label>
                <input id="st-section" className="adm-k-input" value={state.helpSection} maxLength={80} disabled={!editable} onChange={(event) => patch({ helpSection: event.target.value })} />
                <p className="adm-k-help">Articles with the same section are grouped together.</p>
              </div>
            )}
            <p className="adm-k-help">The &ldquo;Updated&rdquo; date is set by itself. {item.revisions} {item.revisions === 1 ? "version" : "versions"} kept.</p>
          </div>
        </section>
        <SeoPanel key={item.slug} state={state} onChange={patch} host={host} prefix={prefix} slug={item.slug} wasPublic={publicStatus} saved={editable} onChangeSlug={changeAddress} />
        {editable ? <Suggestions text={bodyText(state.body)} onAdd={addLink} /> : null}
      </aside>

      <ReasonDialog
        open={off}
        title="Take this off the site?"
        body={<p>Visitors will no longer see the text. Choose where its address goes. You can undo this for 30 days.</p>}
        reasons={OFF_REASONS}
        requireReason
        confirmLabel="Take off the site"
        danger
        onCancel={() => setOff(false)}
        onConfirm={async (result) => {
          setOff(false);
          await takeOff(result.reason);
        }}
      />
    </div>
  );
}
