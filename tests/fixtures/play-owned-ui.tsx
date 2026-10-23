import { createRoot } from "react-dom/client";
import { SportProvider } from "../../src/components/sport-context";
import { SportSandbox } from "../../src/components/sport-sandbox";
void fetch("/api/play-owned")
  .then((r) => r.json())
  .then(({ state }) => {
    createRoot(document.getElementById("fixture-root")!).render(
      <SportProvider>
        <main className="page">
          <SportSandbox
            initial={state}
            privateBeta
            apiPath="/api/play-owned"
            navigationPath="/fantasy/play"
          />
        </main>
      </SportProvider>,
    );
  });
