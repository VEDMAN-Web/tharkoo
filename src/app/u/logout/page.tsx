"use client";

import { useEffect } from "react";
import { ResetCard } from "@/components/auth/ResetCard";

export default function Logout() {
  useEffect(() => {
    fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).finally(() => {
      window.location.replace("/");
    });
  }, []);
  return (
    <ResetCard>
      <p className="t-body">Logging out…</p>
    </ResetCard>
  );
}
