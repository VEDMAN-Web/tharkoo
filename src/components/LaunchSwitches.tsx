"use client";

import { createContext, useContext, type ReactNode } from "react";

export type LaunchState = { creditPurchasesOn: boolean; videoCallsOn: boolean };

const SOON: LaunchState = { creditPurchasesOn: false, videoCallsOn: false };
const LaunchContext = createContext<LaunchState>(SOON);

export function LaunchSwitchProvider({ value, children }: { value: LaunchState; children: ReactNode }) {
  return <LaunchContext.Provider value={value}>{children}</LaunchContext.Provider>;
}

export function useLaunchSwitches(): LaunchState {
  return useContext(LaunchContext);
}

export function ComingSoon({ label = "Coming soon" }: { label?: string }) {
  return (
    <span className="tkn-soon" data-tk="coming-soon">
      {label}
    </span>
  );
}
