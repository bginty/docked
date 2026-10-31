import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { MemberTestWallet } from "../../src/components/member-test-wallet";
import { completeSyntheticPurchase } from "./google-native-mock";
function Demo() {
  const [state, setState] = useState<any>(null),
    [confirm, setConfirm] = useState(false);
  useEffect(() => {
    void fetch("/api/test-wallet")
      .then((r) => r.json())
      .then((d) => setState(d.state));
    const open = () => setConfirm(true);
    window.addEventListener("qa-google-checkout", open);
    return () => window.removeEventListener("qa-google-checkout", open);
  }, []);
  return (
    <main style={{ maxWidth: 960, margin: "auto", padding: 16 }}>
      <p>
        ISOLATED UI FIXTURE · not Google checkout · no real accounts or money
      </p>
      {state && <MemberTestWallet initial={state} />}{" "}
      {confirm && (
        <section
          role="dialog"
          aria-label="Synthetic Google confirmation"
          className="panel"
        >
          <h2>Synthetic no-charge confirmation</h2>
          <p>
            9,900 test credits. This is a mocked provider, not a genuine Google
            order.
          </p>
          <button
            className="primary"
            onClick={() => {
              setConfirm(false);
              completeSyntheticPurchase();
            }}
          >
            Confirm synthetic purchase
          </button>
          <button
            onClick={() => {
              setConfirm(false);
              completeSyntheticPurchase(true);
            }}
          >
            Cancel
          </button>
        </section>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Demo />);
