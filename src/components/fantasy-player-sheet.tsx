"use client";
import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import type { FantasyCard, FantasyState } from "@/core/fantasy";
import { footballBreakdown, localTime } from "@/core/fantasy-play";

export function FantasySheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current,
      active = document.activeElement as HTMLElement | null;
    node?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const back = () => onClose();
    window.addEventListener("popstate", back);
    return () => {
      node?.close();
      document.body.style.overflow = old;
      window.removeEventListener("popstate", back);
      active?.focus();
    };
  }, [onClose]);
  return (
    <dialog
      ref={dialog}
      className="fantasy-sheet"
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
  card?: Pick<FantasyCard, "colour" | "shirt">;
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
        {card?.shirt ?? "+"}
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
      .filter((s) => s.player_id === card.player_id)
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
  const owned = state.cards.some(
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
          <p>
            {card.status} ·{" "}
            {owned ? "In your collection" : "Historical lineup card"}
          </p>
        </div>
      </div>
      <div className="player-detail-metrics">
        <div>
          <small>
            {selected
              ? `Round ${selected.round?.round ?? "—"} · simulated`
              : "Recent points"}
          </small>
          <strong>{selected?.score ?? "—"}</strong>
        </div>
        <div>
          <small>
            {card.tier} · {card.season}
          </small>
          <strong>
            #{card.serial}
            <span> / {card.max_supply.toLocaleString()}</span>
          </strong>
        </div>
      </div>
      <p className="small-note">
        Rarity is collectible scarcity. Every tier uses the same fantasy
        scoring; no paid multiplier.
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
          <p>Player scoring breakdown is unavailable for this round.</p>
        )}
      </section>
      <section>
        <h3>Fixtures & availability</h3>
        <p>
          Authorised upcoming fixtures and live availability data are not
          connected. “{card.status}” is the fictional catalogue status.
        </p>
      </section>
      <details>
        <summary>Card identity & ownership history</summary>
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
        {state.provenance
          .filter((e) => e.card_id === card.id)
          .map((e) => (
            <p key={e.id}>
              {e.reason} · {localTime(e.created_at)}
            </p>
          ))}
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
        <Link href="/fantasy/cards">View collection</Link>
      </footer>
    </FantasySheet>
  );
}
