"use client";

import { useState } from "react";
import { Button, Notice } from "@/components/admin/ui";
import type { UserDetail } from "@/server/admin/users";
import { editProfileAction } from "./actions";
import { useAnswer } from "./useAnswer";
import "./profile.css";

const NAME_MAX = 60;

/** Edit profile: name, city (sellers) and the sign-in phone number. The email is read only: it needs the user. */
export function ProfileTab({ detail, canEdit }: { detail: UserDetail; canEdit: boolean }) {
  const { user } = detail;
  const answer = useAnswer();
  const [name, setName] = useState(user.name);
  const [city, setCity] = useState(user.city ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = name.trim() !== user.name || (user.seller && city.trim() !== (user.city ?? "")) || (phone.trim() !== "" && phone.trim() !== (user.phone ?? ""));
  const closed = user.status === "deleted";
  const editable = canEdit && !closed;

  async function save() {
    setBusy(true);
    setError("");
    const result = await editProfileAction({ userId: user.id, name, city: user.seller ? city : undefined, phone: phone.trim() === (user.phone ?? "") ? undefined : phone, reason });
    setBusy(false);
    if (!result.ok) setError(result.message);
    else if (answer(result, "The profile change")) setReason("");
  }

  return (
    <form
      className="adm-up"
      data-tk="profile-tab"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {closed ? <Notice kind="warn">This account was closed. It cannot be edited.</Notice> : null}
      {!canEdit ? <Notice kind="info">You can look at the profile. Support, trust and safety and admins can change it.</Notice> : null}
      {error ? <p className="adm-k-err" role="alert" data-tk="profile-error">{error}</p> : null}
      <div className="adm-k-field">
        <label className="adm-k-label adm-k-lab" htmlFor="up-name">
          <span>Name</span>
          <span className="adm-k-count">{name.length} / {NAME_MAX}</span>
        </label>
        <input id="up-name" className="adm-k-input" value={name} maxLength={NAME_MAX} disabled={!editable} onChange={(event) => setName(event.target.value)} />
      </div>
      {user.seller ? (
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="up-city">City</label>
          <input id="up-city" className="adm-k-input" value={city} maxLength={NAME_MAX} disabled={!editable} onChange={(event) => setCity(event.target.value)} />
        </div>
      ) : null}
      <div className="adm-k-field">
        <label className="adm-k-label" htmlFor="up-phone">Phone number</label>
        <input id="up-phone" className="adm-k-input" inputMode="tel" value={phone} placeholder="Not added" disabled={!editable} onChange={(event) => setPhone(event.target.value)} aria-describedby="up-phone-help" />
        <p className="adm-k-help" id="up-phone-help">The number they sign in with. A 10-digit number is read as an Indian number.</p>
      </div>
      <div className="adm-k-field">
        <span className="adm-k-label">Email</span>
        <p className="adm-up-email" data-tk="profile-email">{user.email}</p>
        <p className="adm-k-help">The email cannot be changed here. An email change needs the user to confirm it.</p>
      </div>
      {editable ? (
        <>
          <div className="adm-k-field">
            <label className="adm-k-label" htmlFor="up-reason">Reason (optional)</label>
            <input id="up-reason" className="adm-k-input" value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} />
            <p className="adm-k-help">Saved in History. You can undo a change for 30 days.</p>
          </div>
          <div className="adm-up-actions">
            <Button type="submit" kind="primary" busy={busy} disabled={!dirty || busy}>Save profile</Button>
          </div>
        </>
      ) : null}
    </form>
  );
}
