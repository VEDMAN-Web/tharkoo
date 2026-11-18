"use client";

import { useEffect, useState } from "react";
import { DataTable, Notice, TextField, type Column } from "@/components/admin/ui";
import { clipSeconds } from "@/components/post/mediaUpload";
import { uploadStaffFile } from "@/components/upload/staff-upload";
import { BATCH_PARALLEL, checkBatch, imageTypeOf } from "@/server/media/batch";
import { runLimited } from "@/server/media/run-limited";
import { readZipImages } from "@/server/media/zip-images";
import type { DryRunReport, ImportRowReport } from "@/server/listings/import";
import type { JobSummary } from "@/server/import/job";
import { IMPORT_HELP_LINES } from "@/server/import/template";
import { isVideoFile, videoTypeOf, type ChosenVideo } from "@/server/import/videos";
import { chunkAction, createJobAction, dryRunAction, jobAction, openJobAction } from "./actions";

const COLUMNS: Column<ImportRowReport>[] = [
  { key: "line", label: "Line", sortable: true },
  { key: "title", label: "Title", sortable: true },
  { key: "ok", label: "Result", sortable: true, value: (row) => (row.ok ? "OK" : "Error") },
  { key: "errors", label: "Problems", value: (row) => row.errors.join("; ") },
];

const FILE_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime";

interface UploadRow {
  name: string;
  state: "queued" | "uploading" | "done" | "failed";
  reason: string;
}

/** A chosen video: the file to send, and what the browser read about it (size, type and length). */
interface ChosenClip {
  file: File;
  info: ChosenVideo;
}

/** A file the job still needs to receive. */
interface PendingFile {
  name: string;
  file: File;
  kind: "image" | "video";
}

/** A ZIP entry or a picked file may carry no type. The type is set from the name, so the server gets the real one. */
function typed(file: File): File {
  const type = isVideoFile(file) ? videoTypeOf(file) : (imageTypeOf(file) ?? file.type);
  return type === file.type ? file : new File([file], file.name, { type });
}

async function describeVideo(file: File): Promise<ChosenClip> {
  const seconds = await clipSeconds(file);
  return {
    file,
    info: { name: file.name, size: file.size, type: file.type, seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : null },
  };
}

/** The chosen files a job still needs: the photos and videos its rows name, minus the ones already stored. */
function pendingFor(job: JobSummary, images: File[], clips: ChosenClip[]) {
  const items: PendingFile[] = [];
  const notChosen: string[] = [];
  for (const name of job.filesToUpload.filter((item) => !job.uploadedFiles.includes(item))) {
    const file = images.find((item) => item.name === name);
    if (file) items.push({ name, file, kind: "image" });
    else notChosen.push(name);
  }
  for (const name of job.videosToUpload.filter((item) => !job.uploadedVideos.includes(item))) {
    const clip = clips.find((item) => item.info.name === name);
    if (clip) items.push({ name, file: clip.file, kind: "video" });
    else notChosen.push(name);
  }
  return { items, notChosen };
}

async function uploadFile(jobId: string, item: PendingFile): Promise<{ ok: true } | { ok: false; reason: string }> {
  // H13.1: straight to Cloudinary with a signed request, so a normal phone photo is not stopped by the host's request limit.
  const result = await uploadStaffFile({ purpose: "import", kind: item.kind, file: item.file, jobId, legacy: { url: "/admin/import/files/", fields: { jobId, kind: item.kind } } });
  return result.ok ? { ok: true } : { ok: false, reason: result.error };
}

export function ImportForm({ canPublish }: { canPublish: boolean }) {
  const [partner, setPartner] = useState("");
  const [csv, setCsv] = useState("");
  const [csvName, setCsvName] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [clips, setClips] = useState<ChosenClip[]>([]);
  const [refused, setRefused] = useState<string[]>([]);
  const [publishNow, setPublishNow] = useState(false);
  const [dry, setDry] = useState<DryRunReport | null>(null);
  const [job, setJob] = useState<JobSummary | null>(null);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /** A closed page can leave an import half done. Offer to continue it. */
  useEffect(() => {
    void openJobAction().then((res) => {
      if (res.ok && res.data) setJob(res.data);
    });
  }, []);

  /** Photos are checked here (type and size). Videos are kept whatever they are: the dry run reports each problem on its row. */
  async function chooseFiles(list: File[]) {
    const chosen = list.map(typed);
    const check = checkBatch(chosen.filter((file) => !isVideoFile(file)), 500, { anySize: true });
    setImages(check.accepted);
    setRefused(check.rejected.map((item) => `${item.name}: ${item.reason}`));
    setClips(await Promise.all(chosen.filter((file) => isVideoFile(file)).map(describeVideo)));
    setDry(null);
  }

  async function pickZip(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      // No size cap here: an oversized entry is refused with its reason, not dropped silently.
      const entries = await readZipImages(await file.arrayBuffer(), Number.POSITIVE_INFINITY);
      await chooseFiles(entries.map((entry) => new File([entry.data as BlobPart], entry.name)));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not read this ZIP file");
    }
  }

  async function pickCsv(file: File | undefined) {
    setDry(null);
    setError("");
    if (!file) {
      setCsv("");
      setCsvName("");
      return;
    }
    setCsvName(file.name);
    setCsv(await file.text());
  }

  async function check() {
    setBusy(true);
    setError("");
    const res = await dryRunAction({ partnerEmail: partner, csv, fileNames: images.map((file) => file.name), videos: clips.map((clip) => clip.info) });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setDry(res.data);
  }

  /** Uploads the photos and videos the job still needs, then imports the rows in blocks until the job is done. */
  async function drive(current: JobSummary) {
    setJob(current);
    setError("");
    const { items, notChosen } = pendingFor(current, images, clips);
    if (notChosen.length) {
      setError(`Choose these files to finish the import: ${notChosen.slice(0, 8).join(", ")}`);
      return;
    }
    if (items.length) {
      setUploads(items.map(({ name }) => ({ name, state: "queued", reason: "" })));
      const failed: string[] = [];
      await runLimited(items, BATCH_PARALLEL, async (item) => {
        setUploads((rows) => rows.map((row) => (row.name === item.name ? { ...row, state: "uploading" } : row)));
        const result = await uploadFile(current.jobId, item);
        if (!result.ok) failed.push(item.name);
        setUploads((rows) =>
          rows.map((row) => (row.name === item.name ? { ...row, state: result.ok ? "done" : "failed", reason: result.ok ? "" : result.reason } : row)),
        );
      });
      if (failed.length) {
        setError(`${failed.length} file${failed.length === 1 ? " did not" : "s did not"} upload. Retry them, then the rows are imported.`);
        return;
      }
    }
    await importRows(current.jobId);
  }

  async function importRows(jobId: string) {
    let last = -1;
    for (;;) {
      const res = await chunkAction(jobId);
      if (!res.ok) return setError(res.error);
      setJob(res.data);
      if (res.data.state === "done" || res.data.nextRow <= last) return;
      last = res.data.nextRow;
    }
  }

  async function start() {
    setBusy(true);
    setError("");
    const created = await createJobAction({
      partnerEmail: partner,
      csv,
      fileNames: images.map((file) => file.name),
      videos: clips.map((clip) => clip.info),
      status: publishNow ? "active" : "pending",
    });
    if (!created.ok) {
      setBusy(false);
      return setError(created.error);
    }
    setDry(null);
    await drive(created.data.job);
    setBusy(false);
  }

  /** Continues an unfinished job after a reload. Choose the same images again if photos were not all sent. */
  async function resume() {
    if (!job) return;
    setBusy(true);
    setError("");
    const fresh = await jobAction(job.jobId);
    if (!fresh.ok) {
      setBusy(false);
      return setError(fresh.error);
    }
    await drive(fresh.data);
    setBusy(false);
  }

  function startAgain() {
    setJob(null);
    setUploads([]);
    setCsv("");
    setCsvName("");
    setImages([]);
    setClips([]);
    setRefused([]);
    setDry(null);
    setError("");
  }

  const uploadFailures = uploads.filter((row) => row.state === "failed");
  const awaitingFiles = job ? job.filesToUpload.length + job.videosToUpload.length > job.uploadedFiles.length + job.uploadedVideos.length : false;
  const unusedFiles = dry ? [...dry.photos.unusedFiles, ...dry.videos.unusedFiles] : [];
  const ready = Boolean(partner.trim() && csv);
  const running = busy;
  const finished = job?.state === "done";
  const shown = dry ?? null;

  return (
    <div className="adm-stack">
      {job && !finished ? (
        <Notice kind="warn" title="An import is not finished">
          {job.partnerEmail}: {job.nextRow} of {job.total} rows done.{" "}
          {awaitingFiles
            ? "Choose the same photos and videos again, then continue. Files already sent are skipped."
            : "Continue to import the rest."}
          <div style={{ marginTop: 8 }}>
            <button type="button" className="adm-btn" disabled={running} onClick={() => void resume()}>
              {running ? "Working..." : "Continue import"}
            </button>
          </div>
        </Notice>
      ) : null}

      <section className="adm-card">
        <div style={{ display: "grid", gap: 16, maxWidth: 640 }}>
          <TextField label="Partner account email" value={partner} onChange={(value) => { setPartner(value); setDry(null); }} required help="The account must be ID-verified." />
          <div className="adm-field">
            <label className="adm-field-label" htmlFor="import-file">CSV file *</label>
            <input id="import-file" className="adm-input" type="file" accept=".csv,text/csv" onChange={(event) => void pickCsv(event.target.files?.[0])} />
            <p className="adm-field-help">{csvName ? `Chosen: ${csvName}` : "Up to 500 rows. Download the template below to see every column."}</p>
            <p className="adm-field-help" style={{ margin: 0 }}>
              <a href="/admin/import/template/" download>Download the CSV template</a>
            </p>
          </div>
          <div className="adm-field">
            <label className="adm-field-label" htmlFor="import-images">Photos and videos: choose the files, or one ZIP of them</label>
            <input
              id="import-images"
              className="adm-input"
              type="file"
              multiple
              accept={FILE_ACCEPT}
              onChange={(event) => void chooseFiles(Array.from(event.target.files ?? []))}
            />
            <input className="adm-input" type="file" accept=".zip,application/zip" aria-label="ZIP of photos and videos" onChange={(event) => void pickZip(event.target.files?.[0])} />
            <p className="adm-field-help">
              {images.length || clips.length
                ? `${images.length} photo${images.length === 1 ? "" : "s"} and ${clips.length} video${clips.length === 1 ? "" : "s"} chosen. Name each file in the photos or videos column of the CSV, for example flat1-a.jpg|flat1-b.jpg.`
                : "Name each file in the photos or videos column of the CSV. Photos of any size. Videos mp4, webm or mov, up to 10 MB and 30 seconds each."}
            </p>
            {refused.length ? <Notice kind="warn" title="Not chosen">{refused.slice(0, 8).join("; ")}</Notice> : null}
          </div>
          {canPublish ? (
            <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
              <input type="checkbox" checked={publishNow} onChange={(event) => setPublishNow(event.target.checked)} />
              <span>Publish at once (skip the moderation queue)</span>
            </label>
          ) : null}
          <div>
            <button type="button" className="adm-btn" disabled={!ready || running} onClick={() => void check()}>
              {running && !shown ? "Checking..." : "Step 1: check the file (dry run)"}
            </button>
          </div>
        </div>
        <details style={{ marginTop: 16 }}>
          <summary>How to fill in the CSV</summary>
          <ul className="adm-field-help" style={{ display: "grid", gap: 4, paddingLeft: 18 }}>
            {IMPORT_HELP_LINES.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      </section>

      {error ? <Notice kind="error" title="Could not continue">{error}</Notice> : null}

      {uploads.length > 0 ? (
        <section className="adm-card" style={{ display: "grid", gap: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>Files</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4 }} aria-label="Photo upload progress">
            {uploads.map((row) => (
              <li key={row.name} className="adm-field-help" style={{ overflowWrap: "anywhere" }}>
                {row.name}: {row.state === "done" ? "Done" : row.state === "failed" ? `Failed (${row.reason})` : row.state === "uploading" ? "Uploading" : "Queued"}
              </li>
            ))}
          </ul>
          {uploadFailures.length && !running ? (
            <div>
              <button type="button" className="adm-btn adm-btn-quiet" onClick={() => void resume()}>
                Retry failed files ({uploadFailures.length})
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {job ? (
        <section className="adm-card" style={{ display: "grid", gap: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>{finished ? "Import finished" : "Importing"}</h2>
          <progress value={job.nextRow} max={Math.max(job.total, 1)} aria-label="Rows imported" style={{ width: "100%" }} />
          <p className="adm-field-help" style={{ margin: 0 }} aria-live="polite">
            {job.nextRow} of {job.total} rows done. {job.imported} imported, {job.failed} failed while saving.
            {finished ? ` They are ${job.publishStatus === "active" ? "active" : "pending moderation"} for ${job.partnerEmail}.` : ""}
          </p>
          {finished ? (
            <div>
              <button type="button" className="adm-btn adm-btn-quiet" onClick={startAgain}>
                Start a new import
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {dry ? (
        <>
          <Notice kind={dry.okCount === dry.total ? "info" : "warn"} title="Dry run, nothing has been saved">
            {dry.photos.ads} ad{dry.photos.ads === 1 ? "" : "s"} ready ({dry.okCount} of {dry.total} rows) for {dry.partner.displayName} ({dry.partner.email}).{" "}
            {dry.photos.photosToAttach} photo{dry.photos.photosToAttach === 1 ? "" : "s"} to attach, {dry.photos.filesToUpload.length} image
            {dry.photos.filesToUpload.length === 1 ? "" : "s"} to upload. {dry.videos.videosToAttach} video{dry.videos.videosToAttach === 1 ? "" : "s"} to
            attach, {dry.videos.filesToUpload.length} video{dry.videos.filesToUpload.length === 1 ? "" : "s"} to upload.
            {unusedFiles.length ? ` Not uploaded, no ready row uses them: ${unusedFiles.slice(0, 10).join(", ")}.` : ""}
          </Notice>
          <section>
            <DataTable columns={COLUMNS} rows={dry.rows} rowKey={(row) => String(row.line)} csvName="import-check" />
          </section>
          {dry.okCount > 0 ? (
            <div>
              <button type="button" className="adm-btn" disabled={running} onClick={() => void start()}>
                {running ? "Importing..." : `Step 2: import ${dry.okCount} listing${dry.okCount === 1 ? "" : "s"} as ${publishNow ? "active" : "pending"}`}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {finished && job ? (
        <section>
          <DataTable columns={COLUMNS} rows={job.rowResults} rowKey={(row) => String(row.line)} csvName="import-report" />
        </section>
      ) : null}
    </div>
  );
}
