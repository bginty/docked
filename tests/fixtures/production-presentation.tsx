import { createRoot } from "react-dom/client";
import { AppAuthForm } from "../../src/components/app-auth-forms";
import { AppShell } from "../../src/components/app-shell";
import {
  EnvironmentProvider,
  type EnvironmentPresentation,
} from "../../src/components/environment-context";
import { BrandLogo } from "../../src/components/brand-logo";

const root = createRoot(document.getElementById("fixture-root")!);
declare global {
  interface Window {
    renderEnvironmentFixture: (
      environment: EnvironmentPresentation,
      view: "signup" | "recover" | "shell",
    ) => void;
  }
}
window.renderEnvironmentFixture = (environment, view) =>
  root.render(
    <EnvironmentProvider value={environment}>
      <p className="fixture-label">
        ISOLATED UI FIXTURE · no account or data changes
      </p>
      {view === "shell" ? (
        <AppShell authenticated>
          <h1>Environment presentation</h1>
          <p>
            Research validation pending. No qualifying live data is configured.
          </p>
        </AppShell>
      ) : (
        <section className="app-auth-surface" aria-label="Docked account">
          <header className="app-auth-brand">
            <BrandLogo surface="dark" />
            {!environment.production && (
              <span className="app-auth-preview">PREVIEW</span>
            )}
          </header>
          <div className="app-auth-content">
            <h1>
              {view === "signup"
                ? "Create your Docked account"
                : "Forgot password?"}
            </h1>
            <AppAuthForm
              key={`${environment.production}-${view}`}
              mode={view}
            />
          </div>
        </section>
      )}
    </EnvironmentProvider>,
  );
