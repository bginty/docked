import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { SportSandbox } from "../../src/components/sport-sandbox";
import type { SandboxState } from "../../src/core/sport-sandbox";
function Fixture() {
  const [state, setState] = useState<SandboxState | null>(null);
  useEffect(() => {
    void fetch("/state")
      .then((r) => r.json())
      .then(setState);
  }, []);
  return state ? (
    <SportSandbox initial={state} />
  ) : (
    <p>Loading isolated fixture</p>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
