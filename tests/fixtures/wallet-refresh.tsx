import { createRoot } from "react-dom/client";
import {
  WorkspaceWalletProvider,
  useWorkspaceWallet,
} from "../../src/components/use-workspace-wallet";
function Balance() {
  const w = useWorkspaceWallet("fixture-member", true);
  return (
    <output>
      {w.value?.balance ?? "loading"} {w.status}
    </output>
  );
}
createRoot(document.getElementById("fixture-root")!).render(
  <WorkspaceWalletProvider>
    <Balance />
    <Balance />
    <button
      onClick={() => {
        window.dispatchEvent(new Event("online"));
        window.dispatchEvent(new Event("docked-app-resume"));
        document.dispatchEvent(new Event("visibilitychange"));
      }}
    >
      Resume burst
    </button>
  </WorkspaceWalletProvider>,
);
