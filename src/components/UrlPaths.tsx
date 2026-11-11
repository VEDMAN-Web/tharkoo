"use client";

import { createContext, useContext } from "react";
import { DEFAULT_PATHS, type UrlPaths } from "@/lib/urls";

const UrlPathContext = createContext<UrlPaths>(DEFAULT_PATHS);

export function UrlPathProvider({ paths, children }: { paths: UrlPaths; children: React.ReactNode }) {
  return <UrlPathContext.Provider value={paths}>{children}</UrlPathContext.Provider>;
}

export function useUrlPaths() {
  return useContext(UrlPathContext);
}
