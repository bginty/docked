"use client";
import { createContext, useContext, type ReactNode } from "react";

// Presentation only; every admin destination retains server role/session/MFA checks.
const OwnerNavigation = createContext(false);
export function OwnerNavigationProvider({
  retiredBeta,
  children,
}: {
  retiredBeta: boolean;
  children: ReactNode;
}) {
  return (
    <OwnerNavigation.Provider value={retiredBeta}>
      {children}
    </OwnerNavigation.Provider>
  );
}
export const useRetainedOwnerNavigation = () => useContext(OwnerNavigation);
