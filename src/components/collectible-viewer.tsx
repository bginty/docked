"use client";
import { MarketListingDialog } from "./market-listing-dialog";
import { useEffect, useId, useRef, useState } from "react";
import type { AwardedCard } from "@/core/pack-opening";
import { rarityStyle, rarityPresentation } from "@/core/rarity-theme";
import { collectiblePresentation } from "@/core/card-presentation";
import { fantasyAssets } from "@/brand/fantasy-assets";
import type { PlayerHistory } from "@/core/player-card-history";
import { boundedFetch } from "@/core/bounded-request";
import { PlayerStatistics } from "./player-statistics";
import { CollectibleFrame } from "./collectible-frame";
import { RarityBadge } from "./rarity-badge";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import { FantasySheet } from "./fantasy-sheet";

export type ViewerCard = AwardedCard & { canonical_player_id?: string };
/** Shared interactive wrapper. The existing front component and its styles are untouched. */
export function FlippableCard({
  card,
  appliedMultiplier,
  historySnapshot,
}: {
  card: ViewerCard;
  appliedMultiplier?: number;
  /** Read-only snapshots for protected visual previews; never used as awards. */
  historySnapshot?: PlayerHistory;
}) {
  const [back, setBack] = useState(false),
    [history, setHistory] = useState<PlayerHistory | null>(
      historySnapshot ?? null,
    ),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(!historySnapshot),
    [season, setSeason] = useState<string | undefined>(),
    [details, setDetails] = useState(false),
    [retry, setRetry] = useState(0);
  const [category, setCategory] = useState("");
  const seasonCache = useRef(new Map<string, PlayerHistory>());
  const flip = useRef<HTMLButtonElement>(null),
    p = collectiblePresentation(card),
    player = card.canonical_player_id ?? card.player_id;
  useEffect(() => {
    if (historySnapshot) return;
    const controller = new AbortController();
    let inFlight = false;
    async function refresh() {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;
      try {
        const query = new URLSearchParams({
          player,
          ...(season ? { season } : {}),
        });
        const res = await boundedFetch(`/api/fantasy/card-history?${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw Error("History unavailable");
        const body = (await res.json()) as PlayerHistory;
        if (controller.signal.aborted) return;
        setHistory(body);
        if (body.season) seasonCache.current.set(body.season, body);
        setError(false);
        setLoading(false);
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
          setLoading(false);
        }
      } finally {
        inFlight = false;
      }
    }
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60000);
    return () => {
      controller.abort();
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [player, season, retry, historySnapshot]);
  const changeSeason = (value: string) => {
    const cached = seasonCache.current.get(value);
    setHistory(cached ?? null);
    setLoading(!cached);
    setError(false);
    setSeason(value);
  };
  const toggle = () => {
    setBack((v) => !v);
    flip.current?.focus({ preventScroll: true });
  };
  return (
    <>
      <div className="collectible-flip" data-side={back ? "back" : "front"}>
        <div className="collectible-flip-rotor">
          <div
            className="collectible-flip-front"
            aria-hidden={back}
            inert={back}
          >
            <FantasyCardArtwork
              card={card}
              faceOnly
              variant="detailed"
              appliedMultiplier={appliedMultiplier}
            />
          </div>
          <div
            className={`collectible-face collectible-back collectible-material-${rarityPresentation(card.tier).treatment}`}
            style={rarityStyle(card.tier)}
            aria-hidden={!back}
            inert={!back}
            onClick={toggle}
          >
            <span className="collectible-watermark" aria-hidden="true" />
            <CollectibleFrame />
            <span className="collectible-top">
              <span className="collectible-position">{card.position}</span>
              <RarityBadge
                tier={card.tier}
                appliedMultiplier={appliedMultiplier}
                compact
              />
            </span>
            <div className="collectible-back-content">
              <div className="collectible-back-identity">
                <strong title={card.name}>{card.name}</strong>
              </div>
              <div
                className="collectible-back-history"
                onClick={(e) => e.stopPropagation()}
              >
                {loading ? (
                  <p role="status">Loading player scores…</p>
                ) : error ? (
                  <div role="alert">
                    <p>Scores unavailable.</p>
                    <button
                      onClick={() => {
                        setLoading(true);
                        setRetry((r) => r + 1);
                      }}
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  history && (
                    <PlayerStatistics
                      history={history}
                      name={card.name}
                      position={card.position}
                      sport={card.sport}
                      compact
                      category={category}
                      categoryChange={setCategory}
                      seasonChange={changeSeason}
                      onExpand={() => setDetails(true)}
                    />
                  )
                )}
              </div>
            </div>
            <span className="collectible-edition">
              <span className="collectible-serial">{p.serial}</span>
              <img
                className="collectible-brand"
                src={fantasyAssets.compact}
                width="100"
                height="28"
                alt="Docked"
              />
            </span>
          </div>
        </div>
        <button
          ref={flip}
          type="button"
          className={`collectible-flip-control ${back ? "is-back" : ""}`}
          onClick={toggle}
          aria-label={`${back ? "Back" : "Front"} of ${card.name} card. Show ${back ? "front" : "player statistics"}.`}
          aria-pressed={back}
        >
          {back && <span>↻ Tap to flip</span>}
        </button>
        <span className="sr-only" role="status">
          {back ? "Card back: player statistics" : "Card front"}
        </span>
      </div>
      {details && (
        <FantasySheet
          title={`${card.name} · Game Log`}
          className="statistics-sheet"
          historyEntry
          onClose={() => setDetails(false)}
        >
          {loading ? (
            <p role="status">Loading statistics…</p>
          ) : error ? (
            <p role="alert">Statistics unavailable. Retry from the card.</p>
          ) : (
            history && (
              <PlayerStatistics
                history={history}
                name={card.name}
                position={card.position}
                sport={card.sport}
                category={category}
                categoryChange={setCategory}
                seasonChange={changeSeason}
              />
            )
          )}
        </FantasySheet>
      )}
    </>
  );
}
export function CardSellAction({ card }: { card: ViewerCard }) {
  const [selling, setSelling] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [eligibility, setEligibility] = useState<{
      allowed: boolean;
      reason: string;
    } | null>(null),
    id = useId();
  useEffect(() => {
    const controller = new AbortController();
    void boundedFetch(
      `/api/marketplace?tab=listings&sell=${encodeURIComponent(card.id)}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (res) => {
        if (!res.ok) throw Error("Unavailable");
        const { state } = await res.json();
        const own = state.inventory.find(
          (c: { id: string }) => c.id === card.id,
        );
        const reason =
          card.tier === "CORE"
            ? "Core cards cannot be sold for credits."
            : !own
              ? "Only the current owner can sell this card."
              : own.listed
                ? "Already listed. Manage it through My Listings."
                : own.transferReason ||
                  (!own.tradeable
                    ? "This card cannot be sold."
                    : !state.tradingEnabled
                      ? "Card sales are not enabled yet."
                      : "");
        if (!controller.signal.aborted)
          setEligibility({ allowed: !reason, reason });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setEligibility({
            allowed: false,
            reason: "Sale eligibility unavailable. Reopen the viewer to retry.",
          });
      });
    return () => controller.abort();
  }, [card.id, card.tier, refresh]);
  return (
    <div className="collectible-sell-action">
      {selling && (
        <MarketListingDialog
          card={card}
          onClose={() => setSelling(false)}
          onSaved={() => setRefresh((v) => v + 1)}
        />
      )}
      {eligibility?.allowed ? (
        <button className="button" onClick={() => setSelling(true)}>
          Sell card
        </button>
      ) : (
        <>
          <button className="button" disabled aria-describedby={id}>
            Sell card
          </button>
          <p id={id} role="status">
            {eligibility?.reason ?? "Checking sale eligibility…"}
          </p>
        </>
      )}
    </div>
  );
}
export function CollectibleViewer({
  card,
  onClose,
  appliedMultiplier,
}: {
  card: ViewerCard;
  onClose: () => void;
  appliedMultiplier?: number;
}) {
  return (
    <FantasySheet
      title={card.name}
      onClose={onClose}
      className="collectible-viewer"
    >
      <div className="card-detail-art">
        <FlippableCard
          key={card.id}
          card={card}
          appliedMultiplier={appliedMultiplier}
        />
        <CardSellAction key={card.id} card={card} />
      </div>
    </FantasySheet>
  );
}
