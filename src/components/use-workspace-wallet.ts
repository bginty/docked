"use client";
import type { PortfolioValuation } from "@/core/portfolio-valuation";
import { useEffect, useState } from "react";
import { boundedFetch } from "@/core/bounded-request";
/** Existing authenticated wallet projection only. Never substitute gameplay points. */
export function useWorkspaceWallet(member: string, enabled: boolean) {
  const [value, setValue] = useState<{
    member: string;
    balance: number;
    unopened: number;
    portfolio: PortfolioValuation | null;
  } | null>(null);
  const [status, setStatus] = useState("Loading balance…");
  useEffect(() => {
    if (!enabled) return;
    let current: AbortController | undefined;
    let disposed = false;
    const read = async () => {
      current?.abort();
      const controller = new AbortController();
      current = controller;
      setValue(null);
      setStatus("Loading balance…");
      try {
        const response = await boundedFetch("/api/test-wallet", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw Error();
        const { state } = await response.json();
        if (
          state.member !== member ||
          !Number.isSafeInteger(state.wallet?.spendable) ||
          !Array.isArray(state.packs)
        )
          throw Error();
        if (!disposed && !controller.signal.aborted) {
          setValue({
            member,
            balance: state.wallet.spendable,
            portfolio: state.portfolio ?? null,
            unopened: state.packs.filter(
              (p: { status: string }) => p.status === "SEALED",
            ).length,
          });
          setStatus("");
        }
      } catch {
        if (!disposed && !controller.signal.aborted) {
          setValue(null);
          setStatus("Balance unavailable");
        }
      }
    };
    const resume = () => {
      void read();
    };
    const visible = () => {
      if (document.visibilityState === "visible") resume();
    };
    resume();
    window.addEventListener("online", resume);
    window.addEventListener("docked-app-resume", resume);
    document.addEventListener("visibilitychange", visible);
    return () => {
      disposed = true;
      current?.abort();
      window.removeEventListener("online", resume);
      window.removeEventListener("docked-app-resume", resume);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [member, enabled]);
  return { value: value?.member === member ? value : null, status };
}
