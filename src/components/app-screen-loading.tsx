import { AppShell } from "./app-shell";
import { appViewer } from "@/server/app-view";
import { ContentLoading } from "./content-loading";

/** Verify identity before showing member chrome, including during streaming. */
export async function AppScreenLoading() {
  const { who } = await appViewer();
  return (
    <AppShell authenticated={!!who} loading>
      <ContentLoading />
    </AppShell>
  );
}
