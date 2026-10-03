import { AppShell } from "./app-shell";
import { appViewer } from "@/server/app-view";

/** Verify identity before showing member chrome, including during streaming. */
export async function AppScreenLoading() {
  const { who } = await appViewer();
  return (
    <AppShell authenticated={!!who}>
      <section
        className="app-screen-loading"
        aria-label="Loading Docked"
        aria-busy="true"
      >
        <p role="status">Loading your Docked…</p>
        <div className="app-skeleton" aria-hidden="true" />
        <div className="app-skeleton" aria-hidden="true" />
        <div className="app-skeleton" aria-hidden="true" />
      </section>
    </AppShell>
  );
}
