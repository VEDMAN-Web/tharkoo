"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { friendlyError, type ApiError } from "@/lib/ui/api";
import { BODY_MAX, BODY_MIN, SCREENSHOT_MAX_BYTES, SCREENSHOT_MAX_COUNT, SCREENSHOT_TYPES, SUBJECT_MAX, SUBJECT_MIN } from "@/server/support/constants";
import { SCREENSHOT_ACCEPT, SCREENSHOT_LIMIT_TEXT, TOPIC_OPTIONS } from "./labels";
import { postForm } from "./request";

/** Checks the screenshots in the browser too. The server checks them again, so this only saves a round trip. */
function screenshotProblem(files: File[]): string {
  if (files.length > SCREENSHOT_MAX_COUNT) return `Attach up to ${SCREENSHOT_MAX_COUNT} screenshots.`;
  const wrongType = files.find((file) => !(SCREENSHOT_TYPES as readonly string[]).includes(file.type));
  if (wrongType) return `${wrongType.name} is not a JPEG, PNG or WebP image.`;
  const tooBig = files.find((file) => file.size > SCREENSHOT_MAX_BYTES);
  if (tooBig) return `${tooBig.name} is larger than 5 MB.`;
  return "";
}

export function NewTicketForm() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [localError, setLocalError] = useState("");

  function pickFiles(list: FileList | null) {
    const picked = list ? Array.from(list) : [];
    const problem = screenshotProblem(picked);
    setLocalError(problem);
    setFiles(problem ? [] : picked);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (!topic) return setLocalError("Choose a topic.");
    if (subject.trim().length < SUBJECT_MIN) return setLocalError(`Write a subject of at least ${SUBJECT_MIN} characters.`);
    if (body.trim().length < BODY_MIN) return setLocalError(`Describe the problem in at least ${BODY_MIN} characters.`);
    setLocalError("");
    setBusy(true);
    const form = new FormData();
    form.append("topic", topic);
    form.append("subject", subject);
    form.append("body", body);
    for (const file of files) form.append("screenshots", file);
    const res = await postForm<{ id: string }>("/api/support/tickets", form);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.push(`/u/account/support/${res.data.id}/`);
  }

  const fieldErrors = error?.fields || {};
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 16, maxWidth: 640 }} noValidate>
      <div style={{ display: "grid", gap: 6 }}>
        <label htmlFor="support-topic" className="t-small"><strong>What is this about?</strong></label>
        <select id="support-topic" value={topic} onChange={(event) => setTopic(event.target.value)} required className="tk-field" style={{ minHeight: 48, padding: "8px 12px" }}>
          <option value="">Choose a topic</option>
          {TOPIC_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <label htmlFor="support-subject" className="t-small"><strong>Subject</strong></label>
        <input id="support-subject" value={subject} maxLength={SUBJECT_MAX} onChange={(event) => setSubject(event.target.value)} className="tk-field" style={{ minHeight: 48, padding: "8px 12px" }} aria-describedby="support-subject-help" />
        <span id="support-subject-help" className="t-small text-muted">{subject.length}/{SUBJECT_MAX}</span>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <label htmlFor="support-body" className="t-small"><strong>Message</strong></label>
        <textarea id="support-body" value={body} maxLength={BODY_MAX} rows={6} onChange={(event) => setBody(event.target.value)} className="tk-field" style={{ padding: "8px 12px" }} aria-describedby="support-body-help" />
        <span id="support-body-help" className="t-small text-muted">Plain text only. Links are shown as text and are not clickable. {body.length}/{BODY_MAX}</span>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <label htmlFor="support-screenshots" className="t-small"><strong>Screenshots (optional)</strong></label>
        <input id="support-screenshots" type="file" multiple accept={SCREENSHOT_ACCEPT} onChange={(event) => pickFiles(event.target.files)} aria-describedby="support-shots-help" />
        <span id="support-shots-help" className="t-small text-muted">{SCREENSHOT_LIMIT_TEXT}</span>
        {files.length ? <span className="t-small">{files.length} screenshot{files.length === 1 ? "" : "s"} ready to send</span> : null}
      </div>
      {localError || fieldErrors.screenshots ? <p role="alert" className="t-small" style={{ color: "var(--danger, #b42318)", margin: 0 }}>{localError || fieldErrors.screenshots?.[0]}</p> : null}
      {error ? <p role="alert" className="t-small" style={{ color: "var(--danger, #b42318)", margin: 0 }}>{Object.values(fieldErrors)[0]?.[0] || friendlyError(error)}</p> : null}
      <div>
        <button type="submit" className="tk-btn tk-btn-primary" disabled={busy}>{busy ? "Sending..." : "Send ticket"}</button>
      </div>
    </form>
  );
}
