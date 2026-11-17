"use client";

import { ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Notice } from "@/components/admin/ui/Notice";
import { TextField } from "@/components/admin/ui/TextField";
import { BATCH_PARALLEL, checkBatch } from "@/server/media/batch";
import { runLimited } from "@/server/media/run-limited";

type RowState = "queued" | "uploading" | "done" | "failed";

interface Row {
  id: string;
  name: string;
  size: number;
  file: File | null;
  /** A picture of the file itself, made in the browser, so staff see what they are about to send. Empty for a refused file. */
  preview: string;
  state: RowState;
  reason: string;
  alt: string;
}

const LABEL: Record<RowState, string> = { queued: "Ready", uploading: "Uploading", done: "Done", failed: "Failed" };

let counter = 0;
const newId = () => `row-${(counter += 1)}`;
const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Sends one image. A network failure is retried once; a refusal from the server is shown as the reason. */
async function sendOne(file: File, tags: string): Promise<{ ok: true; alt: string } | { ok: false; reason: string }> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const form = new FormData();
    form.set("file", file);
    form.set("auto_alt", "1");
    form.set("tags", tags);
    try {
      const res = await fetch("/admin/media/upload/", { method: "POST", body: form });
      const body = (await res.json()) as { ok: boolean; error?: string; item?: { alt: string } };
      if (body.ok && body.item) return { ok: true, alt: body.item.alt };
      return { ok: false, reason: body.error || "Upload failed" };
    } catch {
      if (attempt === 2) return { ok: false, reason: "Connection problem. Use Retry failed to try again." };
    }
  }
  return { ok: false, reason: "Upload failed" };
}

/**
 * The upload box (H8.57): one big drop area (or choose files with the keyboard), a small picture of every file before it is sent,
 * a note for each file that is refused, and one button to send the ready ones. A file can be taken off the list before sending.
 */
export function BatchUpload({ enabled, onDone }: { enabled: boolean; onDone: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [tags, setTags] = useState("");
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const previews = useRef<string[]>([]);

  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function patch(id: string, change: Partial<Row>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...change } : row)));
  }

  /** A new selection starts a new batch. Files refused here are listed with the reason and never sent. */
  function choose(list: FileList | File[]) {
    if (running) return;
    previews.current.forEach((url) => URL.revokeObjectURL(url));
    previews.current = [];
    const check = checkBatch(Array.from(list));
    const accepted: Row[] = check.accepted.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.push(preview);
      return { id: newId(), name: file.name, size: file.size, file, preview, state: "queued", reason: "", alt: "" };
    });
    const refused: Row[] = check.rejected.map((item) => ({ id: newId(), name: item.name, size: 0, file: null, preview: "", state: "failed", reason: item.reason, alt: "" }));
    setRows([...accepted, ...refused]);
  }

  async function run(targets: Row[]) {
    setRunning(true);
    for (const row of targets) patch(row.id, { state: "queued", reason: "" });
    await runLimited(targets, BATCH_PARALLEL, async (row) => {
      if (!row.file) return;
      patch(row.id, { state: "uploading" });
      const result = await sendOne(row.file, tags);
      patch(row.id, result.ok ? { state: "done", alt: result.alt } : { state: "failed", reason: result.reason });
    });
    setRunning(false);
    onDone();
  }

  const queued = rows.filter((row) => row.state === "queued" && row.file);
  const failed = rows.filter((row) => row.state === "failed" && row.file);
  const doneCount = rows.filter((row) => row.state === "done").length;

  if (!enabled) {
    return (
      <section className="adm-card adm-ml-up">
        <h2>Upload pictures</h2>
        <Notice kind="error">Image upload needs Cloudinary on this server</Notice>
      </section>
    );
  }

  return (
    <section className="adm-card adm-ml-up" aria-labelledby="ml-up-title" data-tk="upload-box">
      <h2 id="ml-up-title">Upload pictures</h2>
      <label
        className="adm-ml-drop"
        data-over={dragging ? "yes" : "no"}
        data-tk="upload-drop"
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          choose(event.dataTransfer.files);
        }}
      >
        <ImagePlus aria-hidden="true" size={28} />
        <strong>Drop pictures here, or choose them</strong>
        <small>Up to 50 at a time, each up to 8 MB. JPEG, PNG or WebP.</small>
        <input
          className="adm-ml-file"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          aria-label="Choose pictures to upload"
          disabled={running}
          onChange={(event) => {
            if (event.target.files) choose(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      <p className="adm-k-help" style={{ margin: 0 }}>The description of each picture starts as its file name and is marked to be checked. Write the real one on the Missing alt tab.</p>
      <TextField label="Tags for this batch (comma separated)" value={tags} onChange={setTags} max={120} help="Optional. Applied to every picture in the batch." />
      {rows.length > 0 ? (
        <>
          <ul className="adm-ml-previews" aria-label="Pictures to upload" data-tk="upload-previews">
            {rows.map((row) => (
              <li key={row.id} className="adm-ml-prev" data-state={row.state} data-tk="upload-row">
                {row.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.preview} alt="" />
                ) : (
                  <span className="adm-ml-prev-none" aria-hidden="true" />
                )}
                <span className="adm-ml-prev-text">
                  <strong>{row.name}</strong>
                  <small>{row.file ? `${kb(row.size)} · ${LABEL[row.state]}` : "Not sent"}</small>
                  {row.state === "done" ? <small>{`Alt: ${row.alt} (from the file name)`}</small> : null}
                  {row.state === "failed" ? <small className="adm-ml-prev-bad">{row.reason}</small> : null}
                </span>
                {row.state === "queued" && row.file && !running ? (
                  <button type="button" className="adm-ml-prev-x" aria-label={`Take ${row.name} off the list`} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}>
                    <X aria-hidden="true" size={16} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="adm-k-help" style={{ margin: 0 }} aria-live="polite">
            {doneCount} uploaded, {failed.length} failed, {queued.length} waiting
          </p>
        </>
      ) : null}
      <div className="adm-ml-up-actions">
        <button type="button" className="adm-btn adm-btn-primary" disabled={running || queued.length === 0} onClick={() => void run(queued)}>
          {running ? "Uploading..." : `Upload ${queued.length} image${queued.length === 1 ? "" : "s"}`}
        </button>
        {failed.length > 0 && !running ? (
          <button type="button" className="adm-btn adm-btn-quiet" onClick={() => void run(failed)}>
            Retry failed ({failed.length})
          </button>
        ) : null}
      </div>
    </section>
  );
}
