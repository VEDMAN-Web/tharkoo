"use client";

import { type FormEvent, useState } from "react";

export interface SellerValues {
  name: string;
  city: string;
  dateOfBirth: string;
  adultConfirmed: boolean;
}

interface Props {
  askDateOfBirth: boolean;
  busy: boolean;
  errors: Record<string, string[]>;
  onSubmit: (values: SellerValues) => void;
}

export function SellerSetup({ askDateOfBirth, busy, errors, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [adultConfirmed, setAdultConfirmed] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ name, city, dateOfBirth, adultConfirmed });
  }

  const nameError = errors.name?.[0];
  const cityError = errors.city?.[0];
  const dobError = errors.dateOfBirth?.[0];

  return (
    <form className="tk-si-stack" onSubmit={submit} noValidate>
      <div>
        <label className="tk-si-lab" htmlFor="tk-si-seller-name">Name shown on your ads</label>
        <input id="tk-si-seller-name" data-focus="" className="tk-si-in" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(nameError) || undefined} aria-describedby={nameError ? "tk-si-seller-name-err" : undefined} required />
        {nameError ? <p id="tk-si-seller-name-err" className="tk-si-error">{nameError}</p> : null}
      </div>

      <div>
        <label className="tk-si-lab" htmlFor="tk-si-seller-city">City</label>
        <input id="tk-si-seller-city" className="tk-si-in" name="city" autoComplete="address-level2" value={city} onChange={(event) => setCity(event.target.value)} aria-invalid={Boolean(cityError) || undefined} aria-describedby={cityError ? "tk-si-seller-city-err" : undefined} required />
        {cityError ? <p id="tk-si-seller-city-err" className="tk-si-error">{cityError}</p> : null}
      </div>

      {askDateOfBirth ? (
        <div>
          <label className="tk-si-lab" htmlFor="tk-si-seller-dob">Date of birth</label>
          <input id="tk-si-seller-dob" className="tk-si-in" name="dateOfBirth" type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} aria-invalid={Boolean(dobError) || undefined} aria-describedby={dobError ? "tk-si-seller-dob-err" : "tk-si-seller-dob-help"} required />
          <p id="tk-si-seller-dob-help" className="tk-si-help" style={{ marginTop: 6 }}>Asked once, only for posting ads. Never shown on your ads.</p>
          <label className="tk-si-check" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={adultConfirmed} onChange={(event) => setAdultConfirmed(event.target.checked)} required />
            <span>I am 18 or older and I will follow the posting rules.</span>
          </label>
          {dobError ? <p id="tk-si-seller-dob-err" className="tk-si-error">{dobError}</p> : null}
        </div>
      ) : null}

      <button type="submit" className="tk-si-primary tk-si-focus" disabled={busy}>
        {busy ? "Saving" : askDateOfBirth ? "Continue to post your ad" : "Save and continue"}
      </button>
    </form>
  );
}
