"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { authUiReadiness } from "@/core/auth-readiness";

export type EnvironmentPresentation = ReturnType<typeof authUiReadiness> & {
  accountConfigured: boolean;
};

// Isolated component previews have no account authority. Real routes always
// receive the server projection; this context never authorises an API request.
const EnvironmentContext = createContext<EnvironmentPresentation>({
  production: false,
  registrationAvailable: false,
  emailAvailable: false,
  invitationAllowed: false,
  policyVersions: null,
  accountConfigured: false,
  reason: "Account services are not configured.",
});

export function EnvironmentProvider({
  value,
  children,
}: {
  value: EnvironmentPresentation;
  children: ReactNode;
}) {
  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironmentPresentation() {
  return useContext(EnvironmentContext);
}
