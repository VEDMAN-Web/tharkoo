"use client";

import { useEffect, useState } from "react";
import { SIGN_IN_EVENT, SIGN_IN_HOST_ATTR, SignInSheet, type SignInEventDetail } from "@/components/auth/SignInSheet";

interface Request {
  id: number;
  next: string;
}

export function SignInPopup({ showMobile, image }: { showMobile: boolean; image: string }) {
  const [request, setRequest] = useState<Request | null>(null);

  useEffect(() => {
    function onOpen(event: Event) {
      const detail = (event as CustomEvent<SignInEventDetail>).detail;
      const here = window.location.pathname + window.location.search;
      setRequest((previous) => ({ id: (previous?.id ?? 0) + 1, next: detail?.next ?? here }));
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
          <SignInSheet key={request.id} mode="popup" initialNext={request.next} showMobile={showMobile} image={image} onClose={() => setRequest(null)} />
        </div>
      ) : null}
    </div>
  );
}
