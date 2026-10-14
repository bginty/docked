"use client";
import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
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
  useEffect(() => {
    const node = dialog.current,
      active = document.activeElement as HTMLElement | null;
    node?.showModal();
    const containFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !node) return;
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
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const back = () => onClose();
    window.addEventListener("popstate", back);
    return () => {
      node?.removeEventListener("keydown", containFocus);
      node?.close();
      document.body.style.overflow = old;
      window.removeEventListener("popstate", back);
      active?.focus();
    };
  }, [onClose]);
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
export function PlayerShirt({
  card,
}: {
  card?: Pick<FantasyCard, "colour" | "shirt"> & { sport?: string };
}) {
  return (
    <svg className="pitch-shirt" viewBox="0 0 100 90" aria-hidden="true">
      <path
        d="M30 8 8 23 19 43 29 38 29 84 71 84 71 38 81 43 92 23 70 8 61 16 39 16Z"
        fill={card?.colour ?? "var(--field-empty)"}
        stroke="currentColor"
        strokeWidth="2"
      />
      <text
        x="50"
        y="59"
        textAnchor="middle"
        fill="white"
        fontSize="27"
        fontWeight="800"
      >
        {card?.sport === "nfl" ? "D" : (card?.shirt ?? "+")}
      </text>
    </svg>
  );
}
export function FantasyPlayerDetails({
  card,
  state,
  roundId,
  onClose,
  onSelect,
  onBench,
}: {
  card: FantasyCard;
  state: FantasyState;
  roundId?: string;
  onClose: () => void;
  onSelect?: () => void;
  onBench?: () => void;
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
  return (
    <FantasySheet title={card.name} onClose={onClose}>
      <div className="player-sheet-identity">
        <PlayerShirt card={card} />
        <div>
          <p className="eyebrow">
            {card.sport} · {card.position}
          </p>
          <h3>{card.team}</h3>
          {card.edition_team && card.edition_team !== card.team && (
            <p>
              Edition team: {card.edition_team}. Current roster team shown
              above.
            </p>
          )}
          <p>
            {card.status} ·{" "}
            {owned ? "In your collection" : "Historical lineup card"}
          </p>
        </div>
      </div>
      <div className="player-detail-metrics">
        <p>
          {rarityRule(card.tier).label} ·{" "}
          {rarityRule(card.tier).multiplierTenths / 10}× in Salary Cap / Open.
          Legacy equal-scoring competitions remain 1.0×.
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
