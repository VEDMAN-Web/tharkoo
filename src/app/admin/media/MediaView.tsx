"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ImageOff, Lock, RotateCcw, SearchX, Trash2, Upload } from "lucide-react";
import { Badge, Button, Drawer, FilterBar, Notice, PageHeader, ReasonDialog, ToastProvider, useToast } from "@/components/admin/ui";
import { FocalPicker } from "@/components/admin/FocalPicker";
import { ImagePicker, type ImageRef } from "@/components/admin/ui/ImagePicker";
import type { MediaItem } from "@/server/layout/media";
import type { MediaDetail, MediaTabCounts } from "@/server/layout/media-admin";
import type { MediaUsage } from "@/server/layout/media-refs";
import { BatchUpload } from "./BatchUpload";
import { MEDIA_PAGE_SIZE, MEDIA_TABS, type MediaTab } from "./media-tabs";
import { DescribeList } from "./DescribeList";
import { restoreMediaAction, saveMediaDetailsAction, trashManyMediaAction, trashMediaAction, undoManyMediaAction, undoMediaAction } from "./library-actions";
import "./media.css";

type Item = MediaItem & { used: boolean; usedIn: number };

const TAB_LABELS: Record<MediaTab, string> = { pictures: "Pictures", unused: "Not used", missing: "Missing alt", trash: "Trash" };
const SEARCH_DEBOUNCE_MS = 350;
const ALT_MAX = 125;
const ALT_MIN = 3;

const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "");

function usageText(use: MediaUsage): string {
  if (use.kind === "page") return `Page builder > ${use.key === "home" ? "Home" : use.key}${use.scope === "default" ? "" : ` (${use.scope})`} > ${use.blockType} block (${use.where})`;
  return `${use.kind === "category" ? "Category" : "City"} > ${use.label || use.key} > ${use.blockId}`;
}

function DetailDrawer({ detail, onClose, onChanged }: { detail: MediaDetail; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const { item } = detail;
  const [alt, setAlt] = useState(item.alt);
  const [phone, setPhone] = useState<ImageRef | null>(detail.phone ? { assetId: detail.phone.id, src: detail.phone.url, alt: detail.phone.alt, width: detail.phone.width, height: detail.phone.height } : null);
  const [focus, setFocus] = useState({ x: item.focusX, y: item.focusY });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const trashed = detail.trashed;
  const altProblem = alt.trim().length < ALT_MIN ? "Describe the picture in a few words." : alt.length > ALT_MAX ? `Use at most ${ALT_MAX} characters.` : "";
  const dirty = alt !== item.alt || (phone?.assetId ?? null) !== item.phoneVariantId || focus.x !== item.focusX || focus.y !== item.focusY || item.autoAlt;

  async function undo(eventId: string) {
    const answer = await undoMediaAction(eventId);
    toast.show({ kind: answer.ok ? "success" : "error", message: answer.message });
    onChanged();
  }

  async function save() {
    if (altProblem) {
      setError(altProblem);
      return;
    }
    setBusy(true);
    setError("");
    const answer = await saveMediaDetailsAction({ id: item.id, alt, phoneMediaId: phone?.assetId ?? null, focusX: focus.x, focusY: focus.y });
    setBusy(false);
    if (!answer.ok) {
      setError(answer.fields?.alt?.[0] ?? answer.fields?.phone?.[0] ?? answer.message);
      return;
    }
    toast.show(answer.changed ? { kind: "undo", message: "Picture saved.", onUndo: () => void undo(answer.eventId) } : { kind: "success", message: "Nothing changed." });
    onChanged();
  }

  async function trash() {
    setBusy(true);
    const answer = await trashMediaAction(item.id);
    setBusy(false);
    toast.show(answer.ok ? { kind: "undo", message: answer.message, onUndo: () => void undo(answer.eventId as string) } : { kind: "error", message: answer.message });
    if (answer.ok) onChanged();
  }

  async function restore() {
    setBusy(true);
    const answer = await restoreMediaAction(item.id);
    setBusy(false);
    toast.show({ kind: answer.ok ? "success" : "error", message: answer.message });
    if (answer.ok) onChanged();
  }

  return (
    <Drawer
      open
      title={item.alt || "Picture"}
      subtitle="Picture details"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <span className="adm-k-sp" />
          {trashed ? (
            <Button kind="primary" icon={RotateCcw} busy={busy} onClick={() => void restore()}>Restore picture</Button>
          ) : (
            <Button kind="primary" busy={busy} disabled={!dirty} onClick={() => void save()}>Save</Button>
          )}
        </>
      }
    >
      <div className="adm-ml-pane" data-tk="media-drawer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="adm-ml-preview" src={item.url} alt={item.alt} />
        <dl className="adm-ml-kv">
          <div><dt>File</dt><dd>{item.width} x {item.height} · {kb(item.bytes)}</dd></div>
          <div><dt>Uploaded</dt><dd>{day(item.createdAt)}{item.uploadedBy ? ` by ${item.uploadedBy}` : ""}</dd></div>
          {trashed ? <div><dt>In the Trash</dt><dd>Removed for good on {day(item.purgeAfter)}</dd></div> : null}
        </dl>
        {!trashed ? (
          <>
            <div className="adm-k-field">
              <label className="adm-k-label adm-k-lab" htmlFor="ml-alt"><span>Alt text<span className="adm-k-req" aria-hidden="true"> *</span></span><span className="adm-k-count">{alt.length} / {ALT_MAX}</span></label>
              <input id="ml-alt" className="adm-k-input" value={alt} maxLength={ALT_MAX + 40} aria-invalid={altProblem || error ? true : undefined} aria-describedby="ml-alt-h" onChange={(event) => { setAlt(event.target.value); setError(""); }} />
              <p className="adm-k-help" id="ml-alt-h">Say what the picture shows. Required before it can be used.</p>
              {error ? <p className="adm-k-err" role="alert">{error}</p> : null}
            </div>
            <div className="adm-k-field">
              <ImagePicker label="Phone version (optional)" value={phone} onChange={setPhone} />
              <p className="adm-k-help">Shown under 600 px wide, when the main picture crops badly.</p>
            </div>
            <FocalPicker label="Focus point" aspect="4 / 3" src={item.url} x={focus.x} y={focus.y} onChange={(point) => setFocus(point)} />
          </>
        ) : null}
        <h3 className="adm-ml-h3">Where it is used</h3>
        {detail.usages.length ? (
          <ul className="adm-ml-uses" data-tk="media-usages">
            {detail.usages.map((use, index) => (
              <li key={`${use.kind}-${use.key}-${use.blockId}-${use.where}-${index}`}>{usageText(use)}</li>
            ))}
          </ul>
        ) : (
          <p className="adm-k-help" data-tk="media-unused">Not used anywhere yet.</p>
        )}
        {!trashed ? (
          <div className="adm-ml-foot">
            <span className="adm-ml-note">{detail.usages.length ? "Remove it from these places first." : "Trash keeps it for 30 days."}</span>
            <Button kind="danger" icon={detail.usages.length ? Lock : Trash2} busy={busy} disabled={detail.usages.length > 0} onClick={() => void trash()}>Move to Trash</Button>
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}

function Screen({ tab, q, page, total, items, counts, detail, uploadsEnabled }: { tab: MediaTab; q: string; page: number; total: number; items: Item[]; counts: MediaTabCounts; detail: MediaDetail | null; uploadsEnabled: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(q);
  const sent = useRef(q);
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [ticked, setTicked] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const text = next.toString();
    router.push(`${pathname}${text ? `?${text}` : ""}`, { scroll: false });
  }

  useEffect(() => {
    if (search.trim() === sent.current) return;
    const id = window.setTimeout(() => {
      sent.current = search.trim();
      go({ q: search.trim() || null, page: null, open: null });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const numbers: Record<MediaTab, number> = { pictures: counts.pictures, unused: counts.unused, missing: counts.missing, trash: counts.trash };
  const from = total === 0 ? 0 : (page - 1) * MEDIA_PAGE_SIZE + 1;
  const to = Math.min(total, page * MEDIA_PAGE_SIZE);
  const searching = q !== "";
  // Only the pictures on this page can stay ticked, so a tick never reaches a picture that is out of sight.
  const shownIds = new Set(items.map((item) => item.id));
  const picked = ticked.filter((id) => shownIds.has(id));
  const canTick = tab === "pictures" || tab === "unused";

  function tick(id: string, on: boolean) {
    setTicked((current) => (on ? [...new Set([...current, id])] : current.filter((value) => value !== id)));
  }

  async function trashPicked() {
    setConfirming(false);
    setRemoving(true);
    const answer = await trashManyMediaAction(picked);
    setRemoving(false);
    if (!answer.ok) {
      toast.show({ kind: "error", message: answer.message });
      return;
    }
    setTicked([]);
    const stayed = answer.refused.length;
    const words = `Moved ${answer.trashed} ${answer.trashed === 1 ? "picture" : "pictures"} to the Trash.${stayed ? ` ${stayed} ${stayed === 1 ? "is" : "are"} still used on the site and stayed.` : ""}`;
    if (answer.trashed > 0) {
      toast.show({ kind: "undo", message: words, onUndo: () => void undoManyMediaAction(answer.eventIds).then((undone) => { toast.show({ kind: undone.ok ? "success" : "error", message: undone.message }); router.refresh(); }) });
    } else {
      toast.show({ kind: "error", message: stayed ? `Nothing moved. ${answer.refused[0].reason}` : "Nothing moved." });
    }
    router.refresh();
  }
  return (
    <div className="adm-k" data-tk="media-screen">
      <PageHeader
        crumbs={[{ label: "Website" }]}
        title="Media library"
        purpose="Every picture on the site. Open one to change its alt text, phone version and focus point."
        primary={uploadsEnabled ? { key: "upload", label: "Upload pictures", icon: Upload, onClick: () => setUploading((value) => !value), kind: "primary" } : undefined}
      />
      {uploading ? (
        <div className="adm-ml-upload" data-tk="media-upload">
          <BatchUpload enabled={uploadsEnabled} onDone={() => router.refresh()} />
        </div>
      ) : null}
      {!uploadsEnabled ? <Notice kind="warn">Uploads are switched off on this site until the picture storage is set up.</Notice> : null}
      <div className="adm-card adm-ml-flat">
        <div className="adm-ml-tabrow">
        <div className="adm-ml-tabs" role="tablist" aria-label="Media library sections">
          {MEDIA_TABS.map((key) => (
            <button key={key} type="button" role="tab" id={`ml-${key}`} aria-selected={tab === key} className="adm-ml-tab" onClick={() => go({ tab: key === "pictures" ? null : key, page: null, open: null })}>
              {TAB_LABELS[key]} <span className="adm-ml-count">{numbers[key]}</span>
            </button>
          ))}
        </div>
          <Link className="adm-ml-tab" href="/admin/broadcasts/" data-tk="notices-tab">
            Notices <span className="adm-ml-count">{counts.notices}</span>
          </Link>
        </div>
        <div role="tabpanel" aria-labelledby={`ml-${tab}`}>
          <FilterBar search={search} onSearch={setSearch} searchLabel="Search pictures" placeholder="Search alt text or tags" chips={[]} onRemoveChip={() => undefined} />
          {items.length === 0 ? (
            <div className="adm-ml-state" data-tk="media-empty">
              <span className="adm-ml-state-icon" aria-hidden="true">{searching ? <SearchX /> : <ImageOff />}</span>
              <h3>{searching ? `No pictures match "${q}"` : tab === "trash" ? "The Trash is empty" : tab === "unused" ? "Every picture is in use" : tab === "missing" ? "No picture is missing its alt text" : "No pictures yet"}</h3>
              <p>{searching ? "Try the first letters of the alt text, or a tag." : tab === "pictures" ? "Upload a picture with the button at the top." : "Nothing to show here."}</p>
              {searching ? <Button onClick={() => { setSearch(""); sent.current = ""; go({ q: null, page: null }); }}>Clear search</Button> : null}
            </div>
          ) : tab === "missing" ? (
            <DescribeList items={items} onSaved={() => router.refresh()} />
          ) : (
            <ul className="adm-ml-grid" data-tk="media-grid">
              {items.map((item) => (
                <li key={item.id} className="adm-ml-cell">
                  {canTick ? (
                    <label className="adm-ml-tick">
                      <input type="checkbox" checked={picked.includes(item.id)} aria-label={`Select ${item.alt || "picture without a description"}`} data-tk="media-tick" onChange={(event) => tick(item.id, event.target.checked)} />
                    </label>
                  ) : null}
                  <button type="button" className="adm-ml-card" data-open={detail?.item.id === item.id ? "yes" : undefined} onClick={() => go({ open: item.id })}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt="" loading="lazy" />
                    <span className="adm-ml-meta">
                      <strong>{item.alt || "No alt text"}</strong>
                      <small>{tab === "trash" ? `Removed for good ${day(item.purgeAfter)}` : item.used ? `Used in ${item.usedIn} ${item.usedIn === 1 ? "place" : "places"}` : "Not used"}</small>
                    </span>
                    {item.missingAlt && tab !== "trash" ? <Badge tone="warn">Missing alt</Badge> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {picked.length > 0 ? (
            <div className="adm-ml-bulk" role="region" aria-label="Selected pictures" data-tk="bulk-bar">
              <strong>{`${picked.length} selected`}</strong>
              <Button onClick={() => setTicked(items.map((item) => item.id))}>Select all on this page</Button>
              <Button kind="quiet" onClick={() => setTicked([])}>Clear</Button>
              <span className="adm-k-sp" />
              <Button kind="danger" icon={Trash2} busy={removing} onClick={() => setConfirming(true)}>Move to Trash</Button>
            </div>
          ) : null}
          <div className="adm-ml-pager">
            <span>{total === 0 ? "0 pictures" : `${from} to ${to} of ${total.toLocaleString("en-IN")}`}</span>
            <span className="adm-k-sp" />
            <Button disabled={page <= 1} onClick={() => go({ page: page - 1 <= 1 ? null : String(page - 1), open: null })}>Previous</Button>
            <Button disabled={to >= total} onClick={() => go({ page: String(page + 1), open: null })}>Next</Button>
          </div>
        </div>
      </div>
      <ReasonDialog
        open={confirming}
        title={`Move ${picked.length} ${picked.length === 1 ? "picture" : "pictures"} to the Trash?`}
        body="They stay in the Trash for 30 days and can be put back. A picture that a page, category or place still uses is not moved."
        confirmLabel="Move to Trash"
        danger
        onConfirm={() => void trashPicked()}
        onCancel={() => setConfirming(false)}
      />
      {detail ? (
        <DetailDrawer
          key={detail.item.id + detail.item.alt + String(detail.trashed)}
          detail={detail}
          onClose={() => go({ open: null })}
          onChanged={() => {
            go({ open: null });
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/** The Media library (H8.45): tabs, search, a grid of pictures, and a drawer with the details of one picture. */
export function MediaView(props: { tab: MediaTab; q: string; page: number; total: number; items: Item[]; counts: MediaTabCounts; detail: MediaDetail | null; uploadsEnabled: boolean }) {
  return (
    <ToastProvider>
      <Screen {...props} />
    </ToastProvider>
  );
}
