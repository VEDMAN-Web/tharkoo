"use client";

import { useCallback, useEffect, useState } from "react";
import { PROMOTE_EVENT, type PromoteOptions } from "./openPromote";
import { PromoteSheet } from "./PromoteSheet";

export function PromoteHost() {
  const [options, setOptions] = useState<PromoteOptions | null>(null);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<PromoteOptions>).detail;
      if (detail?.listingId) setOptions(detail);
    };
    window.addEventListener(PROMOTE_EVENT, onOpen);
    return () => window.removeEventListener(PROMOTE_EVENT, onOpen);
  }, []);

  const close = useCallback(() => setOptions(null), []);
  return options ? <PromoteSheet options={options} onClose={close} /> : null;
}
