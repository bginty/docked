import type { ReactNode } from "react";
import { config } from "@/server/config";
import { FantasyLogo } from "./fantasy-brand";

export function AppAuthShell({ children }: { children: ReactNode }) {
  const settings = config();
  const beta = process.env.DOCKED_RELEASE_CHANNEL === "beta";
  return (
    <section className="app-auth-surface" aria-label="Docked account">
      <header className="app-auth-brand">
        <FantasyLogo />
        {(beta || !settings.production) && (
          <span className="app-auth-preview">{beta ? "BETA" : "PREVIEW"}</span>
        )}
      </header>
      <div className="app-auth-content">
        {settings.reviewOnly && (
          <p className="app-auth-hint" role="status">
            PROTECTED APPLICATION REVIEW · Accounts and email are disabled. This
            is not the live beta.
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
