import { createRoot } from "react-dom/client";
import { EdgeComposer } from "../../src/components/edge-composer";
createRoot(document.getElementById("fixture")!).render(
  <>
    <h1>DEMO · isolated reference-price UI</h1>
    <p>Fictional interaction fixture; no account, provider or ledger writes.</p>
    <EdgeComposer onSocial={() => {}} />
  </>,
);
