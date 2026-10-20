"use client";
import { useState } from "react";
import Link from "next/link";
import type { MemberTestView } from "@/core/member-test-wallet";
import { AppIcon, type AppIconName } from "./app-icon";

const shortcuts: [string, string, AppIconName][] = [
  ["Buy packs", "/fantasy/test-wallet?view=packs&packs=buy", "feed"],
  ["My packs", "/fantasy/test-wallet?view=packs&packs=mine", "save"],
  ["Pack history", "/fantasy/test-wallet?view=packs&packs=history", "bell"],
  ["My collection", "/fantasy/cards", "feed"],
  ["Browse market", "/fantasy/market?tab=browse", "edge"],
  ["My listings", "/fantasy/market?tab=listings", "save"],
];
const amount = (n: number) => n.toLocaleString("en-AU");
export function TestWalletOverview({ state: s }: { state: MemberTestView }) {
  const [limit, setLimit] = useState(15);
  const history = [...s.history].sort(
    (a, b) => b.at - a.at || b.id.localeCompare(a.id),
  );
  return (
    <div className="wallet-overview">
      <header className="wallet-heading">
        <div>
          <h1>Test Wallet</h1>
          <span className="wallet-beta">Private beta</span>
        </div>
        <p>Manage your beta credits and view activity.</p>
      </header>
      <section className="wallet-balance" aria-label="Test credit balance">
        <div className="wallet-credit-art" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <p className="eyebrow">Available test credits</p>
        <strong className="wallet-amount">{amount(s.wallet.spendable)}</strong>
        <p>Reserved {amount(s.wallet.reserved)} credits</p>
        <p className="wallet-disclaimer">
          ⓘ Test credits have no cash value and cannot be withdrawn.
        </p>
        <details className="wallet-breakdown">
          <summary>Balance breakdown</summary>
          <dl>
            {[
              ["Total", s.wallet.total],
              ["Available to spend", s.wallet.spendable],
              ["Pending", s.wallet.pending],
              ["Reserved", s.wallet.reserved],
              ["Non-redeemable", s.wallet.restricted],
              ["Recorded withdrawal eligibility", s.wallet.withdrawable],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt>{label}</dt>
                <dd>{amount(Number(value))} credits</dd>
              </div>
            ))}
          </dl>
          <p>
            Eligibility is part of your balance, not extra credits. Redemption
            is unavailable during beta.
          </p>
        </details>
      </section>
      <h2>Quick links</h2>
      <nav className="wallet-shortcuts" aria-label="Wallet quick links">
        {shortcuts.map(([label, href, icon]) => (
          <Link key={label} href={href}>
            <span className="wallet-shortcut-icon">
              <AppIcon name={icon} />
            </span>
            <span>{label}</span>
            <span aria-hidden="true">›</span>
          </Link>
        ))}
      </nav>
      <details className="wallet-history">
        <summary>
          <AppIcon name="feed" />
          <span>
            <strong>Transaction history</strong>
            <small>View purchases, sales and credit adjustments</small>
          </span>
        </summary>
        {history.length ? (
          <>
            <ol>
              {history.slice(0, limit).map((h) => (
                <li key={h.id}>
                  <div>
                    <strong>{h.label}</strong>
                    <p>
                      <time dateTime={new Date(h.at).toISOString()}>
                        {new Date(h.at).toLocaleString("en-AU", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </time>
                    </p>
                    {h.sale && (
                      <p>
                        Sale price {amount(h.sale.price)} · Fee{" "}
                        {amount(h.sale.fee)} · Received {amount(h.sale.net)}{" "}
                        credits
                      </p>
                    )}
                    <details>
                      <summary>Transaction details</summary>
                      <p>{h.reason}</p>
                      <p>Reference: {h.id}</p>
                    </details>
                  </div>
                  <strong
                    className={
                      h.change >= 0 ? "wallet-positive" : "wallet-negative"
                    }
                  >
                    {h.change > 0 ? "+" : ""}
                    {amount(h.change)}
                    <small> credits</small>
                  </strong>
                </li>
              ))}
            </ol>
            {limit < history.length && (
              <button
                className="pack-control secondary"
                onClick={() => setLimit((n) => n + 15)}
              >
                Load more
              </button>
            )}
          </>
        ) : (
          <p>No wallet transactions yet.</p>
        )}
      </details>
    </div>
  );
}
