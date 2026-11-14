"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Link2 } from "lucide-react";

/** "Back to search": goes back in history when the visitor came from this site, otherwise follows the list link. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  function back(event: React.MouseEvent) {
    if (document.referrer && document.referrer.startsWith(window.location.origin)) {
      event.preventDefault();
      window.history.back();
    }
  }
  return (
    <Link href={href} className="tk-back" onClick={back}>
      {children}
    </Link>
  );
}

/** Copy-link share button with its status text. */
export function CopyLinkButton() {
  const [copied, setCopied] = useState("");
  return (
    <>
      <button
        type="button"
        className="tk-share-btn"
        aria-label="Copy link"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied("Link copied");
          } catch {
            setCopied("Copy the address bar.");
          }
        }}
      >
        <Link2 size={18} />
      </button>
      {copied ? <span role="status">{copied}</span> : null}
    </>
  );
}
