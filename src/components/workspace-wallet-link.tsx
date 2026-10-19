"use client";
import Link from "next/link";
import { useWorkspaceWallet } from "./use-workspace-wallet";
export function WorkspaceWalletLink() {
  const wallet = useWorkspaceWallet("", true);
  return (
    <Link
      className="workspace-balance"
      href="/fantasy/test-wallet"
      title="Available test Docked Credits · no cash value"
    >
      <svg
        width="16"
        height="18"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <ellipse cx="10" cy="4" rx="7" ry="2.7" />
        <path d="M3 4v5c0 3.6 14 3.6 14 0V4M3 9v5c0 3.6 14 3.6 14 0V9" />
      </svg>
      {wallet.value ? (
        <>
          <strong>{wallet.value.balance.toLocaleString("en-AU")}</strong>
          <span>
            {wallet.status
              ? `Last checked · ${wallet.status}`
              : "test Docked Credits"}
          </span>
        </>
      ) : (
        <span>{wallet.status || "Balance unavailable"} · Wallet</span>
      )}
    </Link>
  );
}
