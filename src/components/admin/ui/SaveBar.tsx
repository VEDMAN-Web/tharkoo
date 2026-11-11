"use client";

/** Sticky bar at the bottom of editors: Unsaved changes, Save draft, Preview, Publish. */
export function SaveBar({
  dirty,
  busy,
  onSaveDraft,
  onPreview,
  onPublish,
  message,
}: {
  dirty: boolean;
  busy?: boolean;
  onSaveDraft?: () => void;
  onPreview?: () => void;
  onPublish?: () => void;
  message?: string;
}) {
  return (
    <div className="adm-savebar" role="region" aria-label="Save changes">
      <span className={`adm-savebar-status ${dirty ? "is-dirty" : ""}`} aria-live="polite">
        {message || (dirty ? "Unsaved changes" : "All changes saved")}
      </span>
      <div className="adm-savebar-actions">
        {onSaveDraft ? (
          <button type="button" className="adm-btn adm-btn-quiet" disabled={!dirty || busy} onClick={onSaveDraft}>
            Save draft
          </button>
        ) : null}
        {onPreview ? (
          <button type="button" className="adm-btn adm-btn-ghost" disabled={busy} onClick={onPreview}>
            Preview
          </button>
        ) : null}
        {onPublish ? (
          <button type="button" className="adm-btn" disabled={busy} onClick={onPublish}>
            Publish
          </button>
        ) : null}
      </div>
    </div>
  );
}
