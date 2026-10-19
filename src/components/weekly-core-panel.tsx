"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { boundedFetch } from "@/core/bounded-request";
import { weeklyCountdown, type WeeklyCoreView } from "@/core/weekly-core";
import type { AwardedCard, PackReceipt } from "@/core/pack-opening";
import { useServerClock } from "./use-server-clock";
import { PackArtwork } from "./pack-artwork";
import PackOpening from "./pack-opening";
import { CollectibleViewer } from "./collectible-viewer";

export function WeeklyCorePanel({
  member,
  history = false,
  onOpened,
  onState,
}: {
  member: string;
  history?: boolean;
  onOpened?: () => void;
  onState?: (state: WeeklyCoreView | null) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<WeeklyCoreView | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [selected, setSelected] = useState<
    WeeklyCoreView["packs"][number] | null
  >(null);
  const [detail, setDetail] = useState<AwardedCard | null>(null);
  const alive = useRef(true),
    flight = useRef(false),
    pending = useRef<{ pack: string; request: string } | null>(null);
  const generation = useRef(0);
  const reconciledDue = useRef<number | null>(null);
  const read = useCallback(async () => {
    const current = ++generation.current;
    setChecking(true);
    setError("");
    try {
      const response = await boundedFetch("/api/weekly-core", {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || (data.state.enabled && data.state.member !== member))
        throw Error(data.error || "Your account changed. Sign in again.");
      if (alive.current && current === generation.current) setState(data.state);
    } catch (e) {
      if (alive.current && current === generation.current) {
        setState(null);
        setError(e instanceof Error ? e.message : "Weekly packs unavailable");
      }
    } finally {
      if (alive.current && current === generation.current) setChecking(false);
    }
  }, [member]);
  useEffect(() => {
    alive.current = true;
    setState(null);
    setSelected(null);
    pending.current = null;
    void read();
    const focus = () => {
      if (document.visibilityState === "visible") void read();
    };
    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);
    window.addEventListener("docked-app-resume", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      alive.current = false;
      generation.current++;
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", focus);
      window.removeEventListener("docked-app-resume", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [read]);
  const clock = useServerClock(state?.serverTime ?? 0);
  useEffect(() => {
    onState?.(state);
  }, [state, onState]);
  const due = state?.nextIssueAt ? Date.parse(state.nextIssueAt) : Infinity;
  const overdue = clock >= due;
  useEffect(() => {
    if (
      !state?.enabled ||
      !overdue ||
      checking ||
      error ||
      reconciledDue.current === due
    )
      return;
    // One reconciliation for this due time. Errors require an explicit retry/focus.
    const timer = setTimeout(() => {
      reconciledDue.current = due;
      void read();
    }, 1000);
    return () => clearTimeout(timer);
  }, [state?.enabled, overdue, due, checking, error, read]);
  const ready = state?.packs.filter((p) => !p.openedAt) ?? [];
  async function openPack(): Promise<PackReceipt> {
    if (!selected || flight.current)
      throw Error("Opening is already in progress");
    if (selected.receipt) return selected.receipt;
    flight.current = true;
    const request =
      pending.current?.pack === selected.id
        ? pending.current.request
        : crypto.randomUUID();
    pending.current = { pack: selected.id, request };
    try {
      const response = await boundedFetch("/api/weekly-core", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack: selected.id, request }),
      });
      const data = await response.json();
      if (
        !response.ok ||
        data.state?.member !== member ||
        data.receipt?.id !== selected.id
      )
        throw Error(
          data.error || "Unable to confirm opening. Retry this pack safely.",
        );
      if (alive.current) {
        setState(data.state);
        pending.current = null;
        onOpened?.();
        window.dispatchEvent(new Event("docked-app-resume"));
        router.refresh();
      }
      return data.receipt;
    } finally {
      flight.current = false;
    }
  }
  return (
    <>
      <section
        className="fantasy-panel weekly-core-panel"
        aria-label="Weekly starter pack"
      >
        <PackArtwork name="Starter Pack" core />
        <div className="weekly-core-copy">
          <h2>Weekly starter pack</h2>
          <p>4 random Core cards</p>
          {checking ? (
            <p role="status">Checking your packs…</p>
          ) : error ? (
            <p role="alert">{error}</p>
          ) : state?.enabled ? (
            <p className={ready.length ? "weekly-ready" : "small-note"}>
              {ready.length
                ? `${ready.length} ${ready.length === 1 ? "pack" : "packs"} ready to open`
                : "All your weekly packs are open"}
            </p>
          ) : (
            <p>Weekly packs are not enabled yet.</p>
          )}
          <div className="actions">
            {ready.length > 0 && !checking && (
              <button
                className="pack-control primary"
                onClick={() => setSelected(ready[ready.length - 1])}
              >
                Open Pack
              </button>
            )}
            {error && (
              <button
                className="pack-control secondary"
                onClick={() => void read()}
              >
                Retry pack check
              </button>
            )}
            {!history && (
              <Link
                className="pack-control secondary"
                href="/fantasy/test-wallet?view=packs&packs=history"
              >
                Pack History
              </Link>
            )}
          </div>
        </div>
        {state?.enabled && (
          <div className="weekly-countdown">
            <span>Next free pack in</span>
            <strong aria-label="Days, hours, minutes and seconds until the next free pack">
              {weeklyCountdown(state.nextIssueAt, clock)}
            </strong>
            <small>Free every seven days</small>
            {overdue && !checking && (
              <button className="play-support" onClick={() => void read()}>
                Refresh packs
              </button>
            )}
          </div>
        )}
      </section>
      {history && state?.enabled && (
        <section className="weekly-history" aria-label="Weekly reward history">
          {state.packs.map((p) => (
            <article
              className="pack-history-row"
              key={p.id}
              data-pack-id={p.id}
            >
              <PackArtwork name="Weekly Core Pack" core compact />
              <div>
                <h3>Weekly Core Pack</h3>
                <p>Free reward · {p.openedAt ? "Opened" : "Ready to open"}</p>
                <p className="small-note">
                  Issued {new Date(p.issuedAt).toLocaleString("en-AU")}
                  {p.openedAt &&
                    ` · Opened ${new Date(p.openedAt).toLocaleString("en-AU")}`}
                </p>
              </div>
              <button
                className="pack-control secondary"
                onClick={() => setSelected(p)}
              >
                {p.openedAt ? "Replay" : "Open Pack"}
              </button>
            </article>
          ))}
          <p className="small-note">
            Replays show the saved result. No new cards are awarded.
          </p>
        </section>
      )}
      {selected && (
        <PackOpening
          userId={member}
          name="Weekly Core Pack"
          packType="WEEKLY_CORE"
          receipt={selected.receipt}
          replay={!!selected.receipt}
          openPack={openPack}
          onClose={() => setSelected(null)}
          onViewCard={(c) => {
            setSelected(null);
            setDetail(c);
          }}
          ownedIds={[]}
          collectionHref="/fantasy/cards?sport=nfl"
        />
      )}
      {detail && (
        <CollectibleViewer card={detail} onClose={() => setDetail(null)} />
      )}
    </>
  );
}
