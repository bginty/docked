"use client";
import { createContext, useContext, type ReactNode } from "react";

// Presentation only; every admin destination retains server role/session/MFA checks.
const OwnerNavigation = createContext(false);
const CustomerModeAvailable = createContext(false);
export function OwnerNavigationProvider({
  retiredBeta,
  children,
  customerModeAvailable = false,
}: {
  retiredBeta: boolean;
  customerModeAvailable?: boolean;
  children: ReactNode;
}) {
  return (
    <OwnerNavigation.Provider value={retiredBeta}>
      <CustomerModeAvailable.Provider value={customerModeAvailable}>
        {children}
      </CustomerModeAvailable.Provider>
    </OwnerNavigation.Provider>
  );
}
export const useRetainedOwnerNavigation = () => useContext(OwnerNavigation);
export const useCustomerModeAvailable = () => useContext(CustomerModeAvailable);
