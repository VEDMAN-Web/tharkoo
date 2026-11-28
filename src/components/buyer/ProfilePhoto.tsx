"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AvatarContent } from "@/components/ui/AvatarContent";
import { AVATAR_EVENT, AVATAR_MAX_BYTES, AVATAR_RULE, AVATAR_TYPES } from "@/lib/ui/avatar";

type Answer = { ok?: boolean; data?: { avatarUrl: string | null }; error?: { message?: string } };

const FAILED = "The photo could not be saved. Please try again.";

/** Settings: add, change or remove the profile photo. */
export function ProfilePhoto({ url, letter }: { url: string | null; letter: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState(url);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function send(init: RequestInit) {
    setBusy(true);
    setNote("");
    try {
      // Not api(): a photo goes as a form, and the browser must set its own content type.
      const res = await fetch("/api/account/avatar/", { ...init, credentials: "same-origin", headers: { accept: "application/json" } });
      const body = (await res.json().catch(() => null)) as Answer | null;
      if (!body?.ok || !body.data) {
        setNote(body?.error?.message || FAILED);
        return;
      }
      setPhoto(body.data.avatarUrl);
      window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: body.data.avatarUrl }));
      router.refresh();
    } catch {
      setNote(FAILED);
    } finally {
      setBusy(false);
    }
  }

  function pick(file: File | undefined) {
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type) || file.size > AVATAR_MAX_BYTES) {
      setNote(AVATAR_RULE);
      return;
    }
    const form = new FormData();
    form.set("photo", file);
    void send({ method: "POST", body: form });
  }

  return (
    <div className="up-setting" data-tk="setting-photo">
      <div className="up-photo-main">
        <span className="up-avatar up-photo" aria-hidden="true">
          <AvatarContent src={photo} fallback={letter} />
        </span>
        <div>
          <p className="up-name">Profile photo</p>
          <p className="up-muted">Shown on your account and on your ads. JPG, PNG or WebP, up to 5 MB.</p>
        </div>
      </div>
      <div className="up-actions">
        <input
          ref={input}
          type="file"
          accept={AVATAR_TYPES.join(",")}
          hidden
          data-tk="photo-input"
          onChange={(event) => {
            pick(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <button type="button" className="up-btn-ghost" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Saving…" : photo ? "Change photo" : "Upload photo"}
        </button>
        {photo ? (
          <button type="button" className="up-btn-ghost" disabled={busy} onClick={() => void send({ method: "DELETE" })}>
            Remove
          </button>
        ) : null}
      </div>
      {note ? <p className="up-note" role="alert">{note}</p> : null}
    </div>
  );
}
