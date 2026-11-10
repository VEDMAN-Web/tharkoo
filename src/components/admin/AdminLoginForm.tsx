"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, friendlyError } from "@/lib/ui/api";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

export function AdminLoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const res = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(friendlyError(res.error));
      return;
    }
    router.push("/admin/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto grid max-w-md gap-4 p-6">
      <h1 className="t-h1">Staff sign in</h1>
      <p className="t-small text-muted">Use the email and password for your staff account.</p>
      <div aria-live="polite" className="t-small text-gold">
        {message}
      </div>
      <Field id="email" label="Email">
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </Field>
      <Field id="password" label="Password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" loading={busy}>
        Sign in
      </Button>
    </form>
  );
}
