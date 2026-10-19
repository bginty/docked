// Controlled route transport only. Real shell, wallet and branded loading components.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { AppShell, PersistentAppShell } from "../../src/components/app-shell";
import { SportProvider } from "../../src/components/sport-context";
import { ContentLoading } from "../../src/components/content-loading";
function Fixture() {
  const [step, setStep] = useState(0),
    [loading, setLoading] = useState(false);
  const before = new URLSearchParams(location.search).has("before");
  const navigate = async () => {
    Object.assign(window, { demoPath: "/fantasy/cards" });
    setLoading(true);
    setStep(1);
    await fetch("/route-data");
    setLoading(false);
    setStep(2);
  };
  const page = (
    <AppShell authenticated loading={loading} key={before ? step : "page"}>
      {loading ? (
        <ContentLoading />
      ) : (
        <>
          <h1>{step ? "Your cards" : "Play"}</h1>
          <button onClick={() => void navigate()}>Navigate to Cards</button>
          <p>Isolated navigation measurement</p>
        </>
      )}
    </AppShell>
  );
  return (
    <SportProvider>
      {before ? page : <PersistentAppShell>{page}</PersistentAppShell>}
    </SportProvider>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
