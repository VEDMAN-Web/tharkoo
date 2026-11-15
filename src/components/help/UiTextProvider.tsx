"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { makeT, type TextFn, type UiTextMap } from "@/lib/ui/text";

const TextContext = createContext<TextFn>(makeT());

/**
 * H7.8: the UI-text overrides for a part of the page (header, chat, help), so client components read their words from
 * the admin store without each one being handed props. Without a provider the code defaults are used.
 */
export function UiTextProvider({ texts, children }: { texts?: UiTextMap; children: ReactNode }) {
  const t = useMemo(() => makeT(texts), [texts]);
  return <TextContext.Provider value={t}>{children}</TextContext.Provider>;
}

export function useT(): TextFn {
  return useContext(TextContext);
}
