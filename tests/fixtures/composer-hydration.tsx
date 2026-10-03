// Isolated browser fixture only: real production composer, no account or writes.
import { hydrateRoot } from "react-dom/client";
import { HydrationView } from "./hydration-view";
Object.assign(window, { composerHydrationErrors: [] });
hydrateRoot(document.getElementById("composer-root")!, <HydrationView />, {
  onRecoverableError(error) {
    (
      window as unknown as { composerHydrationErrors: string[] }
    ).composerHydrationErrors.push(
      error instanceof Error ? error.message : "unknown hydration error",
    );
  },
});
