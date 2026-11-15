"use client";

import type { ReactNode } from "react";

/** H7.30: signs out with a POST only when clicked, then reloads the home page. Nothing signs out on render, focus or hover. */
export function LogoutButton({ className, role, onClick, children }: { className?: string; role?: string; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`logout-btn ${className ?? ""}`}
      role={role}
      onClick={() => {
        onClick?.();
        fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).finally(() => window.location.replace("/"));
      }}
    >
      {children}
    </button>
  );
}
