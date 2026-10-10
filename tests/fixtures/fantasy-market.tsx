import { createRoot } from "react-dom/client";
import { SandboxMarketProposal } from "../../src/components/fantasy-market-proposal";
async function request(path: string, body: object) {
  const response = await fetch("/sandbox/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw Error("Sandbox rejected");
  return response.json();
}
createRoot(document.getElementById("fixture-root")!).render(
  <main className="fantasy-screen">
    <p>
      LOCAL TRANSACTION QA · synthetic cards and mock balances · counterparty
      consent is an explicit test fixture
    </p>
    <SandboxMarketProposal
      sandbox={{
        quote: () => request("quote", {}),
        confirm: (id) => request("confirm", { id }),
      }}
    />
  </main>,
);
