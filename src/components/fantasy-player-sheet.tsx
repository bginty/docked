"use client";
import { upcomingFixtures } from "@/core/lineup-picker";
import { competitionNames } from "@/core/competition-display";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import { PlayerJersey } from "./player-jersey";
import { registerModal, topModal } from "@/core/modal-lifecycle";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { type JerseyMetadata } from "@/core/card-presentation";
import {
  availability,
  cardIdentity,
  scoringContext,
} from "@/core/card-display";
import { rarityRule } from "@/core/card-rarity";
import type { FantasyCard, FantasyState } from "@/core/fantasy";
import { footballBreakdown, localTime } from "@/core/fantasy-play";

export function FantasySheet({
  title,
  onClose,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const node = dialog.current,
      active = document.activeElement as HTMLElement | null;
    if (!node) return;
    node.showModal();
    const release = registerModal(node, () => close.current());
    node.addEventListener("close", release);
    const containFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || topModal() !== node) return;
      const targets = [
        ...node.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length > 0);
      const first = targets[0],
        last = targets.at(-1);
      if (!first) {
        event.preventDefault();
        node.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !node.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !node.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    node?.addEventListener("keydown", containFocus);
    return () => {
      node?.removeEventListener("keydown", containFocus);
      node.removeEventListener("close", release);
      node?.close();
      release();
      if (active?.isConnected && (!topModal() || topModal()?.contains(active)))
        active.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`fantasy-sheet ${className}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet-inner">
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close panel">
            ✕
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
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
  const parts = selected
    ? footballBreakdown(selected.stats, card.position, selected.rules)
    : null;
  const validBreakdown =
    parts && parts.reduce((n, p) => n + p.points, 0) === selected?.score;
  const owned = [...state.cards, ...(state.seven?.inventory ?? [])].some(
    (c) => c.id === card.id && c.owner_id === state.user_id,
  );
  if (lineup) {
    const playerId = card.canonical_player_id ?? card.player_id;
    const fixtures = upcomingFixtures(
      state.seven?.fixtures ?? {},
      roundId,
      playerId,
      lineup.now,
    );
    const recent = scores
      .filter((s) => Number.isFinite(s.score))
      .sort(
        (a, b) =>
          Date.parse(b.round?.locks_at ?? "") -
          Date.parse(a.round?.locks_at ?? ""),
      )
      .slice(0, 3);
    return (
      <FantasySheet
        title={card.name}
        onClose={onClose}
        className="lineup-profile"
      >
        <div className="card-detail-art">
          <FantasyCardArtwork
            showNumber={false}
            card={card}
            faceOnly
            appliedMultiplier={lineup.multiplier}
          />
        </div>
        <div className="profile-facts">
          <div>
            <small>Fantasy salary</small>
            <strong>{lineup.salary.toLocaleString("en-AU")}</strong>
            <small>Roster budget</small>
          </div>
          <div>
            <small>Roster status</small>
            <strong>
              {card.source_status ?? card.status ?? "Unavailable"}
            </strong>
            <small>Injury report unavailable</small>
          </div>
        </div>
        {lineup.replacement && (
          <div className="replacement-budget">
            <strong>Replacement budget</strong>
            <p>
              Outgoing {lineup.replacement.outgoing.toLocaleString("en-AU")} →
              Incoming {lineup.salary.toLocaleString("en-AU")}
            </p>
            <p>
              Change{" "}
              {(lineup.salary - lineup.replacement.outgoing).toLocaleString(
                "en-AU",
              )}{" "}
              · Remaining {lineup.replacement.remaining.toLocaleString("en-AU")}
            </p>
          </div>
        )}
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
        </div>
        {(lineup.onTransfer || lineup.onChoose) && (
          <small>Lineup change · save or update your team to confirm.</small>
        )}
        <section>
          <h3>Recent scores</h3>
          {recent.length ? (
            <>
              <div className="profile-score-list">
                {recent.map((s) => (
                  <div key={s.id}>
                    <strong>Week {s.round?.round ?? "—"}</strong>
                    <span>
                      Base {s.base_score ?? "Unavailable"} · {s.multiplier ?? 1}
                      × = {s.score}
                    </span>
                    <small>
                      {s.round?.locks_at
                        ? localTime(s.round.locks_at)
                        : "Date unavailable"}{" "}
                      · {s.round?.scored_at ? "Final" : "Provisional"}
                    </small>
                  </div>
                ))}
              </div>
              <small>
                Saved competition results and multipliers; not recalculated for
                this card.
              </small>
            </>
          ) : (
            <p>Awaiting verified scoring history.</p>
          )}
        </section>
        <section>
          <h3>Upcoming games</h3>
          {fixtures.length ? (
            fixtures.slice(0, 3).map((f) => (
              <p key={f.fixtureId}>
                {localTime(f.scheduledAt)} · {f.status ?? "Status unavailable"}
                <small className="block-note">Opponent unavailable</small>
              </p>
            ))
          ) : (
            <p>Upcoming fixture data unavailable.</p>
          )}
        </section>
        <details>
          <summary>Card details & rules</summary>
          <p>{cardIdentity(card)}</p>
          <p>Test card · no cash value. Market valuation unavailable.</p>
          <p>{availability(card)}</p>
          <Link
            href={`/fantasy/scoring/how-it-works?competition=${roundId ?? ""}`}
          >
            Competition rules
          </Link>
          <p>
            <Link href={`/fantasy/cards?card=${encodeURIComponent(card.id)}`}>
              Full card details & history
            </Link>
          </p>
          {lineup.onRemove && (
            <button onClick={lineup.onRemove}>Remove from lineup</button>
          )}
        </details>
      </FantasySheet>
    );
  }
  return (
    <FantasySheet title={card.name} onClose={onClose}>
      <div className="card-detail-art">
        <FantasyCardArtwork
          card={card}
          faceOnly
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
      </div>
      <p>
        {owned ? "In your collection" : "Historical lineup card"} ·{" "}
        {card.status}
      </p>
      {card.edition_team && card.edition_team !== card.team && (
        <details>
          <summary>Edition affiliation</summary>
          <p>
            Edition team: {card.edition_team}. Current roster metadata is shown
            on the card.
          </p>
        </details>
      )}
      <div className="player-detail-metrics">
        <p>
          {rarityRule(card.tier).label} ·{" "}
          {rarityRule(card.tier).multiplierTenths / 10}× in{" "}
          {competitionNames.SALARY_CAP} / {competitionNames.OPEN}. Legacy
          equal-scoring competitions remain 1.0×.
        </p>
        <div>
          <small>
            {selected
              ? `Round ${selected.round?.round ?? "—"} · ${selected.scoring_version} · ${state.nfl_beta ? "post-game" : "simulated"}`
              : "Recent points"}
          </small>
          <strong>{selected?.score ?? "—"}</strong>
          {selected && (
            <small>
              Base {selected.base_score ?? selected.score} · saved multiplier{" "}
              {selected.multiplier ?? 1}×
              {selected.round?.locks_at
                ? ` · round locked ${localTime(selected.round.locks_at)}`
                : ""}
            </small>
          )}
        </div>
        <div>
          <small>{card.tier} · Test economy</small>
          <strong>
            {card.tier === "CORE" ? "Free Core" : `#${card.serial}`}
            <span>
              {card.tier === "CORE"
                ? " · unlimited"
                : ` / ${card.max_supply.toLocaleString()}`}
            </span>
          </strong>
        </div>
      </div>
      <p className="small-note">{scoringContext}</p>
      <p>{availability(card)}</p>
      <p>
        <Link
          href={
            roundId
              ? `/fantasy/scoring/how-it-works?competition=${roundId}`
              : "/fantasy/scoring/how-it-works"
          }
        >
          Scoring rules
        </Link>
      </p>
      <section>
        <h3>Scoring breakdown</h3>
        {validBreakdown ? (
          <>
            <p className="small-note">
              Fictional simulation · {selected.scoring_version}
            </p>
            <dl className="score-breakdown">
              {parts.map((p) => (
                <div key={p.label}>
                  <dt>{p.label}</dt>
                  <dd>{p.points}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p>
            {state.nfl_beta ? (
              <Link href="/fantasy/results">
                View post-game player breakdowns and provisional status
              </Link>
            ) : (
              "Player scoring breakdown is unavailable for this round."
            )}
          </p>
        )}
      </section>
      <section>
        <h3>Fixtures & availability</h3>
        <p>
          {state.nfl_beta
            ? "Roster identity is sourced from nflverse. Roster status does not guarantee game participation. Unconfirmed participation or missing statistics stay pending."
            : `Authorised upcoming fixtures and live availability data are not connected. “${card.status}” is the fictional catalogue status.`}
        </p>
      </section>
      <section>
        <h3>Ownership timeline</h3>
        <p>Issued {localTime(card.created_at)}</p>
        {owned &&
          state.packs
            .filter((p) => p.opened_at && p.cards?.includes(card.id))
            .map((p) => (
              <p key={p.id}>Starter pack opened · {localTime(p.opened_at!)}</p>
            ))}
        <p>
          {card.listed ? "Listed for sale" : "Not listed for sale"}.{" "}
          {state.seven?.entries.some((e) =>
            e.snapshot.some((c) => c.card_id === card.id),
          )
            ? "Selected in a submitted team; transfer restrictions depend on kickoff."
            : "No submitted seven-player selection recorded."}
        </p>
        {owned &&
          [...(state.review?.cardHistory[card.id] ?? [])]
            .sort((a, b) => a.at - b.at)
            .map((h, i) => (
              <p key={i}>
                {h.event} · {localTime(new Date(h.at).toISOString())}
              </p>
            ))}
        {owned &&
          state.provenance
            .filter((e) => e.card_id === card.id)
            .map((e) => (
              <p key={e.id}>
                {e.reason} · {localTime(e.created_at)}
              </p>
            ))}
      </section>
      <details>
        <summary>Technical card identity</summary>
        <p>{cardIdentity(card)}</p>
        <p>
          Card <code>{card.id}</code>
        </p>
        <p>
          Edition <code>{card.edition_id}</code>
        </p>
        <p>
          Issued {localTime(card.created_at)} ·{" "}
          {card.tradeable ? "Tradeable under approved rules" : "Not tradeable"}
        </p>
        {!owned && (
          <p>
            This is the entry’s historical card. Current ownership does not
            change its recorded points.
          </p>
        )}
      </details>
      <footer className="sheet-actions">
        {onSelect && (
          <button className="button" onClick={onSelect}>
            Add / replace in lineup · Free
          </button>
        )}
        {onBench && <button onClick={onBench}>Move to reserves</button>}
        {!onSelect && owned && !roundId && (
          <Link className="button" href={`/fantasy/play?card=${card.id}`}>
            Choose lineup · Free
          </Link>
        )}
        {owned && state.nfl_beta && (
          <Link
            href={`/fantasy/market?tab=listings&sell=${encodeURIComponent(card.id)}`}
          >
            {card.listed ? "Listed · View listing" : "Sell Card"}
          </Link>
        )}
        <Link href="/fantasy/cards">View collection</Link>
      </footer>
    </FantasySheet>
  );
}
