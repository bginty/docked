"use client";
import {
  CollectibleViewer,
  FlippableCard,
  CardSellAction,
} from "./collectible-viewer";
import { PlayerJersey } from "./player-jersey";
import { FantasySheet } from "./fantasy-sheet";

import { type JerseyMetadata } from "@/core/card-presentation";
import { rarityRule } from "@/core/card-rarity";
import type { FantasyCard, FantasyState } from "@/core/fantasy";

export { FantasySheet } from "./fantasy-sheet";
export function PlayerShirt({ card }: { card?: JerseyMetadata }) {
  return <PlayerJersey card={card} className="pitch-shirt" />;
}
export function FantasyPlayerDetails({
  card,
  state,
  roundId,
  onClose,
  onSelect,
  onBench,
  lineup,
}: {
  card: FantasyCard;
  state: FantasyState;
  roundId?: string;
  onClose: () => void;
  onSelect?: () => void;
  onBench?: () => void;
  lineup?: {
    multiplier: number;
    salary: number;
    mode: string;
    now: number;
    locked: boolean;
    reason?: string;
    onTransfer?: () => void;
    onRemove?: () => void;
    onChoose?: () => void;
    replacement?: { outgoing: number; remaining: number };
  };
}) {
  const scores = (state.round_details ?? []).flatMap((r) =>
    r.scores
      .filter(
        (s) => s.player_id === (card.canonical_player_id ?? card.player_id),
      )
      .map((s) => ({
        ...s,
        round: state.competitions.find((c) => c.id === r.competition_id),
        id: r.competition_id,
      })),
  );
  const selected =
    scores.find((s) => s.id === roundId) ??
    scores.sort(
      (a, b) =>
        Date.parse(b.round?.locks_at ?? "") -
        Date.parse(a.round?.locks_at ?? ""),
    )[0];
  if (lineup || onSelect || onBench)
    return (
      <FantasySheet
        title={card.name}
        onClose={onClose}
        className="lineup-profile"
      >
        <section
          aria-label="Lineup selection"
          className="lineup-selection-tools"
        >
          {lineup && (
            <>
              <p>
                Fantasy salary {lineup.salary.toLocaleString("en-AU")}
                {lineup.replacement && (
                  <>
                    {" "}
                    · Remaining after replacement{" "}
                    {lineup.replacement.remaining.toLocaleString("en-AU")}
                  </>
                )}
              </p>
              {lineup.locked && (
                <p className="entry-badge">
                  Locked · this round's selection is fixed
                </p>
              )}
              {lineup.reason && <p role="status">{lineup.reason}</p>}
              <div className="profile-actions">
                {lineup.onTransfer && (
                  <button className="button" onClick={lineup.onTransfer}>
                    Replace player
                  </button>
                )}
                {lineup.onChoose && (
                  <button
                    className="button"
                    disabled={!!lineup.reason}
                    onClick={lineup.onChoose}
                  >
                    Use this player
                  </button>
                )}
                {lineup.onRemove && (
                  <button onClick={lineup.onRemove}>Remove from lineup</button>
                )}
              </div>
              {(lineup.onTransfer || lineup.onChoose) && (
                <small>
                  Save or update your team to confirm a lineup change.
                </small>
              )}
            </>
          )}
          {onSelect && (
            <button className="button" onClick={onSelect}>
              Replace player
            </button>
          )}
          {onBench && <button onClick={onBench}>Move to reserves</button>}
        </section>
        <div className="card-detail-art">
          <FlippableCard
            key={card.id}
            card={card}
            appliedMultiplier={lineup?.multiplier}
          />
          <CardSellAction key={card.id} card={card} />
        </div>
      </FantasySheet>
    );
  return (
    <CollectibleViewer
      card={card}
      onClose={onClose}
      appliedMultiplier={
        roundId
          ? (selected?.multiplier ??
            (state.competitions.find((c) => c.id === roundId)?.rules
              .inventory_scope === "invited-nfl-test-v2"
              ? rarityRule(card.tier).multiplierTenths / 10
              : 1))
          : undefined
      }
    />
  );
}
