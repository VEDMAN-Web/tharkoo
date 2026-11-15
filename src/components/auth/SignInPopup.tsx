"use client";

import { useEffect, useState } from "react";
import { SIGN_IN_EVENT, SIGN_IN_HOST_ATTR, SignInSheet, type SignInEventDetail } from "@/components/auth/SignInSheet";
import type { LandingPaths, SignInRole } from "@/components/auth/landing";

interface Request {
  id: number;
  role: SignInRole;
  next: string;
}

export function SignInPopup({ landing, showMobile }: { landing: LandingPaths; showMobile: boolean }) {
  const [request, setRequest] = useState<Request | null>(null);

  useEffect(() => {
    function onOpen(event: Event) {
      const detail = (event as CustomEvent<SignInEventDetail>).detail;
      const here = window.location.pathname + window.location.search;
      setRequest((previous) => ({
        id: (previous?.id ?? 0) + 1,
        role: detail?.role === "seller" ? "seller" : "user",
        next: detail?.next ?? here,
      }));
    }
    window.addEventListener(SIGN_IN_EVENT, onOpen);
    return () => window.removeEventListener(SIGN_IN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!request) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setRequest(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request]);

  return (
    <div {...{ [SIGN_IN_HOST_ATTR]: "" }} hidden={!request}>
      {request ? (
        <div className="tk-si-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setRequest(null)}>
          <SignInSheet
            key={request.id}
            mode="popup"
            initialRole={request.role}
            initialNext={request.next}
            landing={landing}
            showMobile={showMobile}
            onClose={() => setRequest(null)}
          />
        </div>
      ) : null}
    </div>
  );
}
