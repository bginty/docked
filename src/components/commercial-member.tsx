"use client";
import { useEffect, useRef, useState } from "react";
import type { CommercialSport } from "@/core/commercial-billing";
import type { PackShopState } from "@/core/pack-shop-state";
import type { AwardedCard, PackReceipt } from "@/core/pack-opening";
import { boundedFetch } from "@/core/bounded-request";
import { PackShop } from "./pack-shop";
import PackOpening from "./pack-opening";
import { CollectibleViewer } from "./collectible-viewer";
import { GoogleCommercialCredits } from "./google-test-credits";
import { NavigationShortcut } from "./navigation-shortcut";
import { packShopHref } from "@/core/pack-presentation";
import { LightSweep } from "./startup-loading";
type View = PackShopState & {
  next: number | null;
  history: { id: string; at: string; label: string; change: number }[];
};
const endpoint = "/api/store/google/commercial";
/** Settlement adapter only: the existing shop, confirmation, artwork and reveal
 * components remain shared. Server ownership/quotes determine every mutation. */
export function CommercialMember({
  member,
  sport = "nfl",
  surface = "packs",
}: {
  member: string;
  sport?: CommercialSport;
  surface?: "packs" | "wallet";
}) {
  const [view, setView] = useState<View | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [pack, setPack] = useState<string | null>(null),
    [card, setCard] = useState<AwardedCard | null>(null),
    [repeat, setRepeat] = useState<{ product: string; nonce: number } | null>(
      null,
    );
  const [wallet, setWallet] = useState<{
    balance: number;
    spendable: number;
    held: number;
    reviewRequired: boolean;
  } | null>(null);
  const [recovery, setRecovery] = useState(false),
    [completionError, setCompletionError] = useState("");
  const pending = useRef<{ request: string; command: unknown } | null>(null),
    flight = useRef(false),
    alive = useRef(true),
    generation = useRef(0),
    viewRequest = useRef(0),
    walletRequest = useRef(0);
  const key = `docked:commercial:pending:${member}`;
  async function refresh() {
    const current = generation.current,
      request = ++viewRequest.current;
    const r = await boundedFetch(endpoint + "?view=packs", {
      cache: "no-store",
    });
    if (!r.ok) throw Error("Packs could not be loaded. Please retry.");
    const v = (await r.json()) as View;
    if (v.member !== member || v.environment !== "commercial")
      throw Error("Account changed. Sign in again.");
    if (
      alive.current &&
      current === generation.current &&
      request === viewRequest.current
    )
      setView(v);
    return v;
  }
  async function refreshWallet() {
    const current = generation.current,
      request = ++walletRequest.current;
    const r = await boundedFetch(endpoint + "?view=wallet", {
      cache: "no-store",
    });
    if (!r.ok) throw Error("Wallet could not be refreshed.");
    const v = await r.json();
    if (v.member !== member) throw Error("Account changed.");
    if (
      alive.current &&
      current === generation.current &&
      request === walletRequest.current
    )
      setWallet(v.wallet);
  }
  useEffect(() => {
    alive.current = true;
    const current = ++generation.current;
    pending.current = null;
    setRecovery(false);
    setView(null);
    setWallet(null);
    setPack(null);
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        pending.current = JSON.parse(raw);
        setRecovery(true);
      }
    } catch {
      setError("Device storage is required before confirming purchases.");
    }
    void Promise.all([
      refresh(),
      surface === "wallet" ? refreshWallet() : Promise.resolve(),
    ]).catch((e) => {
      if (alive.current && current === generation.current) setError(e.message);
    });
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, [member, attempt, surface]);
  async function purchase(command: unknown) {
    const current = generation.current;
    if (flight.current) throw Error("A purchase is already in progress.");
    if (
      pending.current &&
      JSON.stringify(pending.current.command) !== JSON.stringify(command)
    )
      throw Error("Resolve the pending purchase first.");
    const p = pending.current ?? { request: crypto.randomUUID(), command };
    localStorage.setItem(key, JSON.stringify(p));
    pending.current = p;
    setRecovery(true);
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await boundedFetch(endpoint + "?action=pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: p.request,
          ...(command as object),
          expectedMember: member,
        }),
      });
      const result = await r.json();
      if (!alive.current || current !== generation.current)
        throw Error(
          "Account view changed. Check this purchase from the original account.",
        );
      if (!r.ok) {
        if (result.outcome === "rejected") {
          localStorage.removeItem(key);
          pending.current = null;
          setRecovery(false);
        }
        throw Error(
          result.error ||
            "Purchase status unavailable. Retry the same request.",
        );
      }
      localStorage.removeItem(key);
      pending.current = null;
      setRecovery(false);
      await refresh();
      if (alive.current && current === generation.current) setPack(result.id);
      window.dispatchEvent(new Event("docked-app-resume"));
      return result;
    } catch (e) {
      if (alive.current && current === generation.current)
        setError(e instanceof Error ? e.message : "Please retry.");
      throw e;
    } finally {
      flight.current = false;
      if (alive.current && current === generation.current) setBusy(false);
    }
  }
  const selected = view?.packs.find((p) => p.id === pack);
  const nextPack = view?.packs.find(
    (p) =>
      p.id !== pack && p.status === "SEALED" && p.sport === selected?.sport,
  );
  return (
    <div className="test-wallet pack-wallet">
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            onClick={() => {
              setError("");
              setAttempt((n) => n + 1);
            }}
          >
            Retry loading
          </button>
        </div>
      )}
      {!view && !error && (
        <LightSweep compact label="Loading your wallet and packs…" />
      )}
      {recovery && (
        <p role="status">
          A purchase is awaiting confirmation.{" "}
          <button
            disabled={busy}
            onClick={() => {
              if (pending.current)
                void purchase(pending.current.command).catch(() => {});
            }}
          >
            Check pending purchase
          </button>
        </p>
      )}
      {surface === "wallet" && (
        <>
          <section className="panel">
            <h1>Docked Credits</h1>
            {wallet ? (
              <>
                <strong>
                  {wallet.spendable.toLocaleString("en-AU")} available
                </strong>
                {wallet.reviewRequired && (
                  <p>
                    Spending is paused while a refunded purchase is reviewed.
                    {wallet.held > 0
                      ? ` ${wallet.held.toLocaleString("en-AU")} credits are held.`
                      : ""}{" "}
                    Contact support@docked.com.au.
                  </p>
                )}
                <p>
                  Usable within Docked. Cannot be withdrawn or transferred as
                  cash.
                </p>
              </>
            ) : (
              <p role="status">Loading balance…</p>
            )}
          </section>
          <GoogleCommercialCredits
            member={member}
            onSettled={async () => {
              await refreshWallet();
              await refresh();
            }}
          />
          <div className="actions">
            <NavigationShortcut href={packShopHref(sport)}>
              Buy packs
            </NavigationShortcut>
            <NavigationShortcut href={packShopHref(sport, "mine")}>
              My packs
            </NavigationShortcut>
            <NavigationShortcut href={`/fantasy/cards?sport=${sport}`}>
              My collection
            </NavigationShortcut>
          </div>
          <section className="panel">
            <h2>Recent credit activity</h2>
            {view?.history.length === 0 && <p>No credit activity yet.</p>}
            {view?.history.map((h) => (
              <p key={h.id}>
                <time dateTime={h.at}>
                  {new Date(h.at).toLocaleDateString("en-AU")}
                </time>{" "}
                · {h.label} · {h.change > 0 ? "+" : ""}
                {h.change.toLocaleString("en-AU")} Docked Credits
              </p>
            ))}
          </section>
        </>
      )}
      {surface === "packs" && view && (
        <PackShop
          state={view}
          sport={sport}
          busy={busy}
          recovery={recovery}
          refresh={refresh}
          purchase={(p) =>
            purchase({
              sport: p.sport,
              family: p.tier,
              size: p.cards,
              configurationHash: p.version,
              confirmed: true,
            })
          }
          open={(id) => {
            setPack(id);
            setCompletionError("");
          }}
          repeatRequest={repeat}
          repeatStatus={(_, e) => setCompletionError(e)}
        />
      )}
      {surface === "packs" &&
        view?.next !== null &&
        view?.next !== undefined && (
          <button
            disabled={busy}
            onClick={async () => {
              const current = generation.current,
                request = ++viewRequest.current;
              setBusy(true);
              try {
                const r = await boundedFetch(
                  endpoint + "?view=packs&offset=" + view.next,
                  { cache: "no-store" },
                );
                if (!r.ok) throw Error("Could not load more packs.");
                const next = (await r.json()) as View;
                if (next.member !== member) throw Error("Account changed.");
                if (
                  !alive.current ||
                  current !== generation.current ||
                  request !== viewRequest.current
                )
                  return;
                setView((v) =>
                  v
                    ? {
                        ...next,
                        packs: [
                          ...v.packs,
                          ...next.packs.filter(
                            (p) => !v.packs.some((old) => old.id === p.id),
                          ),
                        ],
                      }
                    : next,
                );
              } catch (e) {
                if (alive.current && current === generation.current)
                  setError((e as Error).message);
              } finally {
                if (alive.current && current === generation.current)
                  setBusy(false);
              }
            }}
          >
            Load more packs
          </button>
        )}
      {selected && (
        <PackOpening
          commercial
          key={selected.id}
          userId={member}
          name={selected.name}
          sport={selected.sport}
          cardCount={selected.cardCount ?? undefined}
          packType={selected.type}
          ownedIds={[]}
          teamHref={null}
          openPack={async () => {
            const r = await boundedFetch(endpoint + "?action=open", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: selected.id, expectedMember: member }),
            });
            if (!r.ok) throw Error("Pack could not be opened. Please retry.");
            const receipt = (await r.json()) as PackReceipt;
            await refresh();
            window.dispatchEvent(new Event("docked-app-resume"));
            return receipt;
          }}
          onClose={() => setPack(null)}
          onViewCard={(c) => setCard(c)}
          collectionHref={`/fantasy/cards?sport=${selected.sport}`}
          completionBusy={busy || recovery}
          completionError={completionError}
          nextPack={
            nextPack
              ? {
                  name: nextPack.name,
                  open: () => {
                    setPack(nextPack.id);
                    setCompletionError("");
                  },
                }
              : undefined
          }
          onBuyAnother={() => {
            if (selected.product && !busy && !recovery)
              setRepeat({ product: selected.product, nonce: Date.now() });
          }}
        />
      )}
      {card && <CollectibleViewer card={card} onClose={() => setCard(null)} />}
    </div>
  );
}
