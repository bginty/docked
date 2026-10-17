"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import type { AwardedCard } from "@/core/pack-opening";
import { rarityRule } from "@/core/card-rarity";
import { rarityStyle, rarityPresentation } from "@/core/rarity-theme";
import { collectiblePresentation } from "@/core/card-presentation";
import { fantasyAssets } from "@/brand/fantasy-assets";
import type { PlayerHistory } from "@/core/player-card-history";
import { boundedFetch } from "@/core/bounded-request";
import {
  adjustedCardPoints,
  formatBasePoints,
} from "@/core/card-score-display";
import { CollectibleFrame } from "./collectible-frame";
import { RarityBadge } from "./rarity-badge";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import { FantasySheet } from "./fantasy-sheet";

export type ViewerCard = AwardedCard & { canonical_player_id?: string };
/** Shared interactive wrapper. The existing front component and its styles are untouched. */
export function FlippableCard({
  card,
  appliedMultiplier,
}: {
  card: ViewerCard;
  appliedMultiplier?: number;
}) {
  const [back, setBack] = useState(false),
    [history, setHistory] = useState<PlayerHistory | null>(null),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(true),
    [season, setSeason] = useState<string | undefined>(),
    [page, setPage] = useState(0),
    [retry, setRetry] = useState(0);
  const flip = useRef<HTMLButtonElement>(null),
    p = collectiblePresentation(card),
    multiplier =
      appliedMultiplier ?? rarityRule(card.tier).multiplierTenths / 10,
    player = card.canonical_player_id ?? card.player_id;
  useEffect(() => {
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
  }, [player, season, retry]);
  const toggle = () => {
    setBack((v) => !v);
    flip.current?.focus({ preventScroll: true });
  };
  return (
    <div className="collectible-flip" data-side={back ? "back" : "front"}>
      <div className="collectible-flip-rotor">
        <div className="collectible-flip-front" aria-hidden={back} inert={back}>
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
              <span className="collectible-given">{p.given}</span>
              <strong className="collectible-family">{p.family}</strong>
              <small>
                {card.position}
                {card.team ? ` · ${card.team}` : ""}
              </small>
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
                  <>
                    {history.seasons.length > 1 ? (
                      <label className="card-season">
                        Season{" "}
                        <select
                          value={history.season ?? ""}
                          onChange={(e) => {
                            setLoading(true);
                            setSeason(e.target.value);
                            setPage(0);
                          }}
                        >
                          {history.seasons.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <h3>
                        {history.season
                          ? `${history.season} season`
                          : "Player history"}
                      </h3>
                    )}
                    <dl className="card-base-stats">
                      <div>
                        <dt>Avg base</dt>
                        <dd>{formatBasePoints(history.averageBase)}</dd>
                      </div>
                      <div>
                        <dt>Best base</dt>
                        <dd>{formatBasePoints(history.bestBase)}</dd>
                      </div>
                      <div>
                        <dt>Played</dt>
                        <dd>{history.played}</dd>
                      </div>
                    </dl>
                    {history.rows.length ? (
                      <>
                        <h4>Recent scores</h4>
                        <table>
                          <thead>
                            <tr>
                              <th>Week</th>
                              <th>Base</th>
                              <th>Adjusted ×{multiplier.toFixed(1)}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.rows
                              .slice(page * 5, page * 5 + 5)
                              .map((r) => (
                                <tr key={r.week}>
                                  <th>
                                    {r.week}
                                    <small>{r.status}</small>
                                    {r.rawStats && (
                                      <details>
                                        <summary>Raw stats</summary>
                                        {r.rawStats.map((g) => (
                                          <div key={g.game}>
                                            {g.incomplete && (
                                              <p>
                                                Game incomplete; verified player
                                                fields shown.
                                              </p>
                                            )}
                                            <dl>
                                              {Object.entries(g.values).map(
                                                ([key, value]) => (
                                                  <div key={key}>
                                                    <dt>
                                                      {key.replaceAll("_", " ")}
                                                    </dt>
                                                    <dd>
                                                      {value === null
                                                        ? "Missing / unconfirmed"
                                                        : value}
                                                    </dd>
                                                  </div>
                                                ),
                                              )}
                                            </dl>
                                          </div>
                                        ))}
                                      </details>
                                    )}
                                  </th>
                                  <td>{formatBasePoints(r.base)}</td>
                                  <td>
                                    {formatBasePoints(
                                      adjustedCardPoints(r.base, multiplier),
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        {history.rows.length > 5 && (
                          <nav aria-label="Score history pages">
                            <button
                              disabled={!page}
                              onClick={() => setPage((n) => n - 1)}
                            >
                              Newer
                            </button>
                            <span>
                              {page + 1} / {Math.ceil(history.rows.length / 5)}
                            </span>
                            <button
                              disabled={(page + 1) * 5 >= history.rows.length}
                              onClick={() => setPage((n) => n + 1)}
                            >
                              Older
                            </button>
                          </nav>
                        )}
                      </>
                    ) : (
                      <p>No published player scores yet.</p>
                    )}
                    <p className="card-score-note">
                      Adjusted = card reference, not owner-earned points. Base
                      averages exclude DNP/bye. Provisional results may change.
                    </p>
                    {history.feed && (
                      <details className="card-score-note">
                        <summary>
                          Season base:{" "}
                          {formatBasePoints(history.feed.seasonBase)}
                          {!history.feed.complete && " · partial"}
                        </summary>
                        <p>
                          {history.feed.stale
                            ? "Update overdue · retained history"
                            : "Postgame history"}
                          . Last import:{" "}
                          {history.feed.lastSuccess
                            ? new Date(
                                history.feed.lastSuccess,
                              ).toLocaleString()
                            : "Unavailable"}
                          .
                        </p>
                        <p>
                          Reference scoring: {history.feed.version}. This
                          history does not award competition points.
                        </p>
                        <p>
                          Statistics:{" "}
                          <a
                            href="https://github.com/nflverse/nflverse-data"
                            target="_blank"
                            rel="noreferrer"
                          >
                            nflverse
                          </a>
                          ,{" "}
                          <a
                            href="https://creativecommons.org/licenses/by/4.0/"
                            target="_blank"
                            rel="noreferrer"
                          >
                            CC BY 4.0
                          </a>
                          . Fantasy points calculated by Docked.
                        </p>
                      </details>
                    )}
                  </>
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
  );
}
export function CardSellAction({ card }: { card: ViewerCard }) {
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
  }, [card.id, card.tier]);
  return (
    <div className="collectible-sell-action">
      {eligibility?.allowed ? (
        <Link
          className="button"
          href={`/fantasy/market?tab=listings&sell=${encodeURIComponent(card.id)}`}
        >
          Sell card
        </Link>
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
