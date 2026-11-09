"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLogin() {
  const router = useRouter();
  const [err, setErr] = useState("");
  return (
    <div className="mx-auto max-w-sm bg-white p-6">
      <h1 className="text-[22px]">Admin login</h1>
      <p className="mt-1 text-[12px] text-[#777]">Email admin@tharkoo.demo · password admin · 2FA 000000</p>
      <form
        className="mt-4 grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const res = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: fd.get("email"),
              password: fd.get("password"),
              otp: fd.get("otp"),
            }),
          });
          if (!res.ok) {
            setErr("Wrong details or 2FA code");
            return;
          }
          router.push("/admin/");
        }}
      >
        <input name="email" className="border px-3 py-2" defaultValue="admin@tharkoo.demo" />
        <input name="password" type="password" className="border px-3 py-2" defaultValue="admin" />
        <input name="otp" className="border px-3 py-2" placeholder="2FA code" defaultValue="000000" />
        <button className="btn-post">Log in</button>
        {err ? <p className="text-[13px] text-[#e20044]">{err}</p> : null}
      </form>
    </div>
  );
}
