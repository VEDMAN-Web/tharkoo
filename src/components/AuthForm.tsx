"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "register" | "forgot" | "reset" | "verify" | "expired" }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState("");

  function goDash(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem("tharkoo-user", "yes");
    router.push("/u/account/dashboard/");
  }

  if (mode === "verify") {
    return (
      <Card title="Confirm your email">
        <p>We sent you a link. Email verified screen after you click it.</p>
        <button type="button" className="btn-post mt-4" onClick={() => setMsg("Resent. Wait 60s.")}>Resend</button>
        {msg ? <p className="mt-2 text-[13px]">{msg}</p> : null}
        <Link href="/u/account/" className="mt-4 inline-block text-sm">Continue to account home</Link>
      </Card>
    );
  }
  if (mode === "forgot") {
    return (
      <Card title="Forgot password">
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); setMsg("Check your inbox."); }}>
          <input className="border px-3 py-2" type="email" required placeholder="Email" />
          <button className="btn-post">Send reset link</button>
        </form>
        {msg ? <p className="mt-3 text-[13px]">{msg}</p> : null}
        <p className="mt-3 text-[12px]"><Link href="/u/reset/">Link expired? Open reset screen</Link></p>
      </Card>
    );
  }
  if (mode === "reset") {
    return (
      <Card title="New password">
        <form className="grid gap-3" onSubmit={goDash}>
          <input className="border px-3 py-2" type="password" required placeholder="New password" />
          <input className="border px-3 py-2" type="password" required placeholder="Confirm password" />
          <button className="btn-post">Save password</button>
        </form>
        <p className="mt-3 text-[12px]"><Link href="/u/forgot/">Send again</Link></p>
      </Card>
    );
  }
  if (mode === "expired") {
    return (
      <Card title="Password expired">
        <p>Reset now to keep using your account. Banner also shows days left before expiry.</p>
        <Link href="/u/reset/" className="btn-post mt-4 inline-block">Reset password</Link>
      </Card>
    );
  }
  if (mode === "register") {
    return (
      <Card title="Register">
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); router.push("/u/verify-email/"); }}>
          <input className="border px-3 py-2" type="email" required placeholder="Email" />
          <input className="border px-3 py-2" type="email" required placeholder="Confirm email" />
          <input className="border px-3 py-2" type={show ? "text" : "password"} required placeholder="Password" />
          <p className="text-[11px] text-[#888]">Strength: use 8+ characters</p>
          <label className="flex gap-2 text-[13px]"><input type="checkbox" required /> Terms of use</label>
          <label className="flex gap-2 text-[13px]"><input type="checkbox" required /> Privacy policy</label>
          <label className="flex gap-2 text-[13px]"><input type="checkbox" defaultChecked /> Marketing emails</label>
          <label className="flex gap-2 text-[13px]"><input type="checkbox" required /> I am not a bot</label>
          <button className="btn-post">Register</button>
        </form>
        <p className="mt-3 text-sm">Already have an account? <Link href="/u/login/">Log in</Link></p>
      </Card>
    );
  }
  return (
    <Card title="Log in">
      <form className="grid gap-3" onSubmit={goDash}>
        <input className="border px-3 py-2" type="email" required placeholder="Email" autoComplete="username" />
        <div className="relative">
          <input className="w-full border px-3 py-2" type={show ? "text" : "password"} required placeholder="Password" autoComplete="current-password" />
          <button type="button" className="absolute right-2 top-2 text-[12px]" onClick={() => setShow((v) => !v)}>{show ? "Hide" : "Show"}</button>
        </div>
        <label className="flex gap-2 text-[13px]"><input type="checkbox" /> Remember me</label>
        <button className="btn-post">Log in</button>
      </form>
      <p className="mt-3 text-sm"><Link href="/u/forgot/">Forgot password</Link></p>
      <p className="mt-1 text-sm"><Link href="/u/register/">Register</Link></p>
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-sm bg-white p-6">
      <h1 className="text-[22px] font-normal">{title}</h1>
      <div className="mt-4">{children}</div>
    </div>
  );
}
