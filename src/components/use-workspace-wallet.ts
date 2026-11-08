"use client";
import type { PortfolioValuation } from "@/core/portfolio-valuation";
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { boundedFetch } from "@/core/bounded-request";
import { createRefreshQueue } from "@/core/refresh-queue";
import { usePathname } from "next/navigation";
import { useEnvironmentPresentation } from "./environment-context";
type WalletProjection = {
  member: string;
  balance: number;
  unopened: number;
  openedPacks: number;
  completedTrades: number;
  portfolio: PortfolioValuation | null;
  commercial: boolean;
};
const WalletContext = createContext<{
  value: WalletProjection | null;
  status: string;
} | null>(null);
export function WorkspaceWalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWorkspaceWallet("", true);
  return createElement(WalletContext.Provider, { value: wallet }, children);
}
/** Existing authenticated wallet projection only. Never substitute gameplay points. */
export function useWorkspaceWallet(member: string, enabled: boolean) {
  const shared = useContext(WalletContext);
  const pathname = usePathname();
  const { commercialSurface } = useEnvironmentPresentation();
  const hasShared = shared !== null;
  const [value, setValue] = useState<WalletProjection | null>(null);
  const [status, setStatus] = useState("Loading balance…");
  useEffect(() => {
    if (!enabled || hasShared) return;
    let current: AbortController | undefined;
    let disposed = false;
    const read = async (isCurrent: () => boolean) => {
      const controller = new AbortController();
      current = controller;
      setStatus("Updating balance…");
      try {
        const response = await boundedFetch(
          commercialSurface
            ? "/api/workspace-wallet"
            : "/api/test-wallet?view=summary",
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          if (
            isCurrent() &&
            (response.status === 401 || response.status === 403)
          )
            setValue(null);
          throw Error();
        }
        const { state } = await response.json();
        if (
          typeof state.member !== "string" ||
          !state.member ||
          (member && state.member !== member) ||
          !Number.isSafeInteger(state.wallet?.spendable) ||
          !Array.isArray(state.packs)
        )
          throw Error();
        if (isCurrent() && !disposed && !controller.signal.aborted) {
          setValue({
            member: state.member,
            commercial: state.environment === "commercial",
            balance: state.wallet.spendable,
            portfolio: state.portfolio ?? null,
            unopened:
              state.environment === "commercial" &&
              Number.isSafeInteger(state.unopened)
                ? state.unopened
                : state.packs.filter(
                    (p: { status: string }) => p.status === "SEALED",
                  ).length,
            openedPacks:
              state.environment === "commercial" &&
              Number.isSafeInteger(state.openedPacks)
                ? state.openedPacks
                : state.packs.filter(
                    (p: { status: string }) => p.status === "OPENED",
                  ).length,
            completedTrades: Array.isArray(state.swaps)
              ? state.swaps.filter(
                  (s: { status: string }) => s.status === "ACCEPTED",
                ).length
              : 0,
          });
          setStatus("");
        }
      } catch {
        if (isCurrent() && !disposed && !controller.signal.aborted) {
          setStatus("Balance refresh unavailable");
        }
      }
    };
    const refresh = createRefreshQueue(read);
    const resume = () => refresh.request();
    const visible = () => {
      if (document.visibilityState === "visible") resume();
    };
    resume();
    window.addEventListener("online", resume);
    window.addEventListener("docked-app-resume", resume);
    document.addEventListener("visibilitychange", visible);
    return () => {
      disposed = true;
      refresh.dispose();
      current?.abort();
      window.removeEventListener("online", resume);
      window.removeEventListener("docked-app-resume", resume);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [member, enabled, hasShared, pathname, commercialSurface]);
  const result = shared ?? { value, status };
  return {
    ...result,
    value: !member || result.value?.member === member ? result.value : null,
  };
}
