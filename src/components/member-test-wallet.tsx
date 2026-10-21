"use client";
import { CollectibleViewer } from "./collectible-viewer";
import { AcquisitionShare } from "./acquisition-share";
import { boundedFetch } from "@/core/bounded-request";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { MemberTestView } from "@/core/member-test-wallet";
import type { PackReceipt } from "@/core/pack-opening";
import PackOpening from "./pack-opening";
import { PackShop } from "./pack-shop";
import { packTitle } from "@/core/pack-presentation";
import { EconomyOwnerReport } from "./economy-owner-report";
import { TestWalletOverview } from "./test-wallet-overview";

export function MemberTestWallet({
  initial,
  surface = "wallet",
}: {
  initial: MemberTestView;
  surface?: "wallet" | "swaps" | "packs";
}) {
  const [s, setS] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pack, setPack] = useState<string | null>(null),
    [details, setDetails] = useState<string | null>(null);
  const [share, setShare] = useState<{
    reference: string;
    cards: { id: string; name: string; tier?: string }[];
  } | null>(null);
  const pending = useRef<{ key: string; id: string } | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [autoPack, setAutoPack] = useState<string | null>(null);
  const [replayPack, setReplayPack] = useState<string | null>(null);
  const storageKey = `docked:test-wallet:pending:${initial.member}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.key === "string" && typeof p.id === "string") {
          pending.current = p;
          setRecovery(true);
        }
      }
    } catch {
      setError("Enable device storage before spending test credits.");
    }
  }, [storageKey]);
  const inFlight = useRef(false);
  async function send(command: Record<string, unknown>) {
    if (inFlight.current)
      throw Error("A transaction is already being confirmed.");
    const key = JSON.stringify(command);
    if (pending.current && pending.current.key !== key)
      throw Error("Check the pending request first");
    const request = pending.current?.id ?? crypto.randomUUID();
    pending.current = { key, id: request };
    // Persist only the idempotency envelope, never credentials or financial truth.
    // A lost response or app restart must retrieve this operation, not purchase again.
    localStorage.setItem(storageKey, JSON.stringify(pending.current));
    setRecovery(true);
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await boundedFetch("/api/test-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, command }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (data.outcome === "rejected") {
          pending.current = null;
          localStorage.removeItem(storageKey);
          setRecovery(false);
        }
        throw Error(data.error);
      }
      if (data.state?.member !== initial.member)
        throw Error(
          "Your account session changed. Sign in again before continuing.",
        );
      setS(data.state);
      window.dispatchEvent(new Event("docked-app-resume"));
      if (
        command.kind === "buy-pack" &&
        typeof data.result?.entitlement === "string"
      ) {
        setAutoPack(data.result.entitlement);
        setPack(data.result.entitlement);
      }
      if (command.kind === "accept") {
        const before = new Set(
          s.cards.filter((c) => c.owner === s.member).map((c) => c.id),
        );
        const received = (data.state as MemberTestView).cards.filter(
          (c) => c.owner === s.member && !before.has(c.id),
        );
        if (received.length)
          setShare({
            reference: request,
            cards: received.map((c) => ({ id: c.id, name: c.name })),
          });
      }
      pending.current = null;
      localStorage.removeItem(storageKey);
      setRecovery(false);
      return data.result;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Connection interrupted. Retry the same action to retrieve its receipt.",
      );
      throw e;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const act = (c: Record<string, unknown>) => void send(c).catch(() => {});
  const mine = s.cards.filter((c) => c.owner === s.member);
  const p = s.packs.find((p) => p.id === pack);
  return (
    <div className={`test-wallet ${surface === "packs" ? "pack-wallet" : ""}`}>
      {share && (
        <AcquisitionShare
          member={s.member}
          reference={share.reference}
          cards={share.cards}
        />
      )}
      {surface === "wallet" && <TestWalletOverview state={s} />}
      {error && <p role="alert">{error}</p>}
      {recovery && (
        <p role="status">
          A test transaction is awaiting confirmation.{" "}
          <button
            disabled={busy}
            onClick={() => {
              if (pending.current) act(JSON.parse(pending.current.key));
            }}
          >
            Retry pending transaction
          </button>
        </p>
      )}
      {surface === "packs" && (
        <>
          <PackShop
            state={s}
            busy={busy}
            recovery={recovery}
            purchase={(product,coupon) =>
              send({
                kind: "buy-pack",
                product: product.id,
                ...(s.economyEnabled ? { configuration: product.version } : {}),
                expectedPrice: coupon?.charge ?? product.price,
                ...(coupon ? {coupon:coupon.code,couponQuote:coupon.fingerprint}:{}),
                confirmed: true,
                policy: s.policy,
              })
            }
            refresh={async () => {
              const r = await boundedFetch("/api/test-wallet", {
                cache: "no-store",
              });
              if (!r.ok) throw Error("Could not refresh packs");
              const data = await r.json();
              if (data.state?.member !== initial.member)
                throw Error("Your account session changed. Sign in again.");
              setS(data.state);
              setError("");
            }}
            open={(id, replay) => {
              setReplayPack(replay ? id : null);
              setPack(id);
            }}
          />
          {p && (
            <PackOpening
              key={p.id}
              replay={p.id === replayPack}
              autoOpen={p.id === autoPack && p.status === "SEALED"}
              userId={s.member}
              name={packTitle(p)}
              packType={p.type ?? undefined}
              receipt={p.receipt}
              ownedIds={mine.map((c) => c.id)}
              openPack={async () =>
                (await send({
                  kind: "open-pack",
                  entitlement: p.id,
                })) as PackReceipt
              }
              onClose={() => setPack(null)}
              onViewCard={(c) => {
                setPack(null);
                setDetails(c.id);
              }}
              collectionHref="/fantasy/cards"
              teamHref={s.economyEnabled ? "/fantasy/play" : null}
            />
          )}
          {surface !== "packs" && (
            <p id="collection">
              <Link href="/fantasy/cards">View your complete collection</Link> ·{" "}
              <Link href="/fantasy/market?tab=listings">
                Manage listings in Market
              </Link>
            </p>
          )}
          {details &&
            s.cards
              .filter((c) => c.id === details)
              .map((c) => (
                <CollectibleViewer
                  key={c.id}
                  card={c}
                  onClose={() => setDetails(null)}
                />
              ))}
        </>
      )}
      {surface === "wallet" && (
        <>
          {s.ownerReport && (
            <details className="wallet-owner-report">
              <summary>Owner-only test report</summary>
              <p>
                No cash backing or payment provider is connected. Grants remain
                restricted to the audited owner operation.
              </p>
              <p>
                Test circulation:{" "}
                {s.ownerReport.circulation.outstanding.toLocaleString()} ·
                reconciliation difference {s.ownerReport.circulation.difference}
                . Commercial payments: 0.
              </p>
              <p>
                Marketplace turnover {s.ownerReport.marketplaceVolume} · seller
                commission {s.ownerReport.commission} · swap fees{" "}
                {s.ownerReport.swapFees} · pack spend{" "}
                {s.ownerReport.packRevenue}. These are test flows, not
                accounting revenue.
              </p>
              <form action="/api/test-wallet" method="get">
                <input type="hidden" name="format" value="csv" />
                <label>
                  From date (Sydney)
                  <input type="date" name="from" />
                </label>
                <label>
                  Through date (Sydney)
                  <input type="date" name="to" />
                </label>
                <button>Export test reconciliation CSV</button>
              </form>
              <details>
                <summary>Funding, balances and reconciliation evidence</summary>
                <pre>{JSON.stringify(s.ownerReport, null, 2)}</pre>
              </details>
              <EconomyOwnerReport state={s} />
            </details>
          )}
        </>
      )}
    </div>
  );
}
