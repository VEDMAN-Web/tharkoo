"use client";

import { useState, type FormEvent } from "react";
import { api, friendlyError } from "@/lib/ui/api";
import { BODY_MAX, BODY_MIN, type SupportTopic } from "@/server/support/constants";

const CONTACT_TOPICS: { value: SupportTopic; label: string }[] = [
  { value: "my_ads", label: "An ad I posted" },
  { value: "coins_payments", label: "Coins and payments" },
  { value: "report_problem", label: "Report a problem" },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactForm() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [topic, setTopic] = useState<SupportTopic>(CONTACT_TOPICS[0].value);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const trimmedContact = contact.trim();
    if (!name.trim()) return setMessage({ tone: "error", text: "Please add your name." });
    if (!trimmedContact) return setMessage({ tone: "error", text: "Add a phone number or email so we can reply." });
    if (body.trim().length < BODY_MIN) return setMessage({ tone: "error", text: `Tell us a little more, at least ${BODY_MIN} characters.` });
    if (body.trim().length > BODY_MAX) return setMessage({ tone: "error", text: `Keep the message under ${BODY_MAX} characters.` });
    setBusy(true);
    setMessage(null);
    const byEmail = EMAIL.test(trimmedContact);
    const res = await api<{ replyVia: "email" | "phone" }>("/api/support/guest/tickets", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        email: byEmail ? trimmedContact : "",
        phone: byEmail ? "" : trimmedContact,
        topic,
        body: body.trim(),
      }),
    });
    setBusy(false);
    if (!res.ok) return setMessage({ tone: "error", text: friendlyError(res.error) });
    setName("");
    setContact("");
    setBody("");
    setMessage({
      tone: "ok",
      text: res.data.replyVia === "email" ? "Thank you. We will reply to your email." : "Thank you. We will reply to your phone number.",
    });
  }

  return (
    <form className="tkp-form" onSubmit={submit} noValidate>
      <div className="tkp-2e">
        <label className="tkp-label">
          <span>Your name</span>
          <input className="tkp-input" name="name" autoComplete="name" placeholder="e.g. Priya" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="tkp-label">
          <span>Phone or email</span>
          <input className="tkp-input" name="contact" placeholder="So we can reply" maxLength={120} value={contact} onChange={(event) => setContact(event.target.value)} />
        </label>
      </div>
      <label className="tkp-label">
        <span>Topic</span>
        <select className="tkp-select" name="topic" value={topic} onChange={(event) => setTopic(event.target.value as SupportTopic)}>
          {CONTACT_TOPICS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="tkp-label">
        <span>Message</span>
        <textarea
          className="tkp-textarea"
          name="message"
          rows={5}
          placeholder="Tell us what happened. Add the ad link if you have it."
          maxLength={BODY_MAX}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      <div className="tkp-form-foot">
        <p className="tkp-form-msg" role="status" data-tone={message?.tone}>
          {message?.text || ""}
        </p>
        <button type="submit" className="tkp-btn" disabled={busy}>
          {busy ? "Sending" : "Send message"}
        </button>
      </div>
    </form>
  );
}
