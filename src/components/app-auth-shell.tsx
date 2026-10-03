import type { ReactNode } from "react";
import { BrandLogo } from "./brand-logo";
import { config } from "@/server/config";

export function AppAuthShell({ children }: { children: ReactNode }) {
  return (
    <section className="app-auth-surface" aria-label="Docked account">
      <header className="app-auth-brand">
        <BrandLogo surface="dark" />
        {!config().production && (
          <span className="app-auth-preview">PREVIEW</span>
        )}
      </header>
      <div className="app-auth-content">{children}</div>
    </section>
  );
}
