"use client";

import { useState } from "react";
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
  state: RowState;
  reason: string;
  alt: string;
}

const LABEL: Record<RowState, string> = { queued: "Queued", uploading: "Uploading", done: "Done", failed: "Failed" };

let counter = 0;
const newId = () => `row-${(counter += 1)}`;

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

export function BatchUpload({ enabled, onDone }: { enabled: boolean; onDone: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [tags, setTags] = useState("");
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);

  function patch(id: string, change: Partial<Row>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...change } : row)));
  }

  /** A new selection starts a new batch. Files refused here are listed with the reason and never sent. */
  function choose(list: FileList | File[]) {
    if (running) return;
    const check = checkBatch(Array.from(list));
    const accepted: Row[] = check.accepted.map((file) => ({ id: newId(), name: file.name, size: file.size, file, state: "queued", reason: "", alt: "" }));
    const refused: Row[] = check.rejected.map((item) => ({ id: newId(), name: item.name, size: 0, file: null, state: "failed", reason: item.reason, alt: "" }));
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
      <section className="adm-card" style={{ display: "grid", gap: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800 }}>Upload images</h2>
        <Notice kind="error">Image upload needs Cloudinary on this server</Notice>
      </section>
    );
  }

  return (
    <section className="adm-card" style={{ display: "grid", gap: 12 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800 }}>Upload images</h2>
      <p className="adm-field-help" style={{ margin: 0 }}>
        Up to 50 images at a time, each up to 8 MB (jpeg, png or webp). The alt text is filled from the file name and marked for review. You can
        change it on the card below.
      </p>
      <div
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
        style={{
          border: `2px dashed ${dragging ? "var(--adm-accent, #2563eb)" : "var(--adm-border, #cbd5e1)"}`,
          borderRadius: 12,
          padding: 16,
          display: "grid",
          gap: 8,
          justifyItems: "start",
        }}
      >
        <label className="adm-field">
          <span className="adm-field-label">Choose images, or drop them here</span>
          <input
            className="adm-input"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={running}
            onChange={(event) => {
              if (event.target.files) choose(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      <TextField label="Tags for this batch (comma separated)" value={tags} onChange={setTags} max={120} help="Optional. Applied to every image in the batch." />
      {rows.length > 0 ? (
        <>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }} aria-label="Upload progress">
            {rows.map((row) => (
              <li key={row.id} style={{ display: "grid", gap: 2, borderBottom: "1px solid var(--adm-border, #e2e8f0)", paddingBottom: 6 }}>
                <span style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", minWidth: 0 }}>
                  <span style={{ overflowWrap: "anywhere", fontWeight: 600 }}>{row.name}</span>
                  <span className="adm-field-help">{LABEL[row.state]}</span>
                </span>
                {row.state === "done" ? <span className="adm-field-help">Alt: {row.alt} (auto, check it)</span> : null}
                {row.state === "failed" ? <span className="adm-field-help" style={{ color: "var(--adm-danger, #b91c1c)" }}>{row.reason}</span> : null}
              </li>
            ))}
          </ul>
          <p className="adm-field-help" style={{ margin: 0 }} aria-live="polite">
            {doneCount} uploaded, {failed.length} failed, {queued.length} waiting
          </p>
        </>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" className="adm-btn" disabled={running || queued.length === 0} onClick={() => void run(queued)}>
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
