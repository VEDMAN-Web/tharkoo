"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Logout() {
  const router = useRouter();
  useEffect(() => {
    fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).finally(() => {
      router.replace("/");
      router.refresh();
    });
  }, [router]);
  return <p className="p-8 t-body">Logging out…</p>;
}
