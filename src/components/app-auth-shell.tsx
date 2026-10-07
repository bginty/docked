import type { ReactNode } from "react";
import { BrandLogo } from "./brand-logo";
import { config } from "@/server/config";
import { fantasyEnabled } from "@/core/fantasy";
import { FantasyLogo } from "./fantasy-brand";

export function AppAuthShell({ children }: { children: ReactNode }) {
  const fantasy = fantasyEnabled();
  const Root = fantasy ? "main" : "section";
  return (
    <Root
      id={fantasy ? "main" : undefined}
      className="app-auth-surface"
      aria-label="Docked account"
    >
      <header className="app-auth-brand">
        {fantasyEnabled() ? <FantasyLogo /> : <BrandLogo surface="dark" />}
        {!config().production && (
          <span className="app-auth-preview">PREVIEW</span>
        )}
      </header>
      <div className="app-auth-content">{children}</div>
    </Root>
  );
}
