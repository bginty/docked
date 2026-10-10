"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FantasyCard, FantasyState } from "@/core/fantasy";
import {
  countdown,
  eligibleForPosition,
  fantasySports,
  formationFor,
  historicalCards,
  lineupIssues,
  localTime,
  playRounds,
} from "@/core/fantasy-play";
import {
  FantasyPlayerDetails,
  FantasySheet,
  PlayerShirt,
} from "./fantasy-player-sheet";
type Act = (
  action: string,
  payload?: Record<string, unknown>,
) => Promise<Record<string, unknown> | null>;
export function FantasyPlay({
  data,
  busy,
  act,
}: {
  data: FantasyState;
  busy: boolean;
  act: Act;
}) {
  const [sport, setSport] = useState("football"),
    [view, setView] = useState<"team" | "points">(() => {
      const at = Date.parse(
        data.server_time ??
          data.rewards?.server_time ??
          new Date().toISOString(),
      );
      const current = playRounds(data, "football", at).current;
      return current && historicalCards(data, current.id).length
        ? "points"
        : "team";
    }),
    [list, setList] = useState(false);
  const [now, setNow] = useState(() =>
    Date.parse(
      data.server_time ?? data.rewards?.server_time ?? new Date().toISOString(),
    ),
  );
  const clock = useRef({ server: now, local: Date.now() });
  const [chosen, setChosen] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [draftFor, setDraftFor] = useState(""),
    [dirty, setDirty] = useState(false),
    [notice, setNotice] = useState("");
  const [slot, setSlot] = useState<{
      position: string;
      replace?: string;
    } | null>(null),
    [detail, setDetail] = useState<FantasyCard | null>(null),
    [search, setSearch] = useState(""),
    [tier, setTier] = useState("");
  const [pointRound, setPointRound] = useState("");
  const close = useCallback(() => {
    setSlot(null);
    setDetail(null);
  }, []);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`docked-sport:${data.user_id}`);
      if (fantasySports.some((s) => s.id === saved)) setSport(saved!);
    } catch {
      /* Preference storage is optional. */
    }
  }, [data.user_id]);
  useEffect(() => {
    const base = Date.parse(
      data.server_time ?? data.rewards?.server_time ?? new Date().toISOString(),
    );
    clock.current = { server: base, local: Date.now() };
  }, [data.server_time, data.rewards?.server_time]);
  useEffect(() => {
    const tick = () =>
      setNow(clock.current.server + Date.now() - clock.current.local);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const { rounds, current, next } = playRounds(data, sport, now);
  const comp = rounds.find((c) => c.id === chosen) ?? next;
  const saved =
    data.entries.find((e) => e.competition_id === comp?.id)?.cards ?? [];
  const savedKey = [...saved].sort().join(",");
  const draftKey = [...selected].sort().join(",");
  useEffect(() => {
    if (dirty && draftFor === comp?.id && savedKey === draftKey) {
      setDirty(false);
      setNotice("Team confirmed on the server. Competition entry saved.");
    }
  }, [dirty, draftFor, comp?.id, savedKey, draftKey]);
  const ids = dirty && draftFor === comp?.id ? selected : saved;
  const picked = ids
    .map((id) => data.cards.find((c) => c.id === id))
    .filter((c): c is FantasyCard => !!c);
  const formation = formationFor(comp);
  const locked =
    !comp ||
    !!comp.scored_at ||
    Date.parse(comp.locks_at) <= now ||
    (!!comp.opens_at && Date.parse(comp.opens_at) > now);
  const issues = comp ? lineupIssues(data.cards, ids, comp, data.user_id) : [];
  const history = rounds
    .filter((c) => Date.parse(c.locks_at) <= now)
    .sort((a, b) => Date.parse(b.locks_at) - Date.parse(a.locks_at));
  const viewed = history.find((c) => c.id === pointRound) ?? current;
  const result = data.results.find(
    (r) =>
      r.user_id === data.user_id &&
      r.competition_id === (view === "points" ? viewed?.id : current?.id),
  );
  const scoredSeason = rounds
    .filter((c) => c.season === (current ?? next)?.season)
    .map((c) => c.id);
  const seasonResults = data.results.filter(
    (r) =>
      r.user_id === data.user_id && scoredSeason.includes(r.competition_id),
  );
  const seasonPoints = seasonResults.length
    ? seasonResults.reduce((n, r) => n + r.score, 0)
    : null;
  const displayed =
    view === "points" && viewed ? historicalCards(data, viewed.id) : picked;
  const fieldFormation = formationFor(view === "points" ? viewed : comp);
  const roundScores = data.round_details?.find(
    (r) => r.competition_id === viewed?.id,
  )?.scores;
  const change = (newIds: string[]) => {
    setSelected(newIds);
    setDraftFor(comp?.id ?? "");
    setDirty(true);
    setNotice("Unsaved team changes");
  };
  const discard = () =>
    !dirty || window.confirm("Discard unsaved team changes?");
  function openSlot(position: string, replace?: string) {
    setSearch("");
    setTier("");
    setSlot({ position, replace });
  }
  function add(card: FantasyCard) {
    if (!comp || locked) return;
    const same = picked.filter((c) => c.position === card.position);
    const replacement =
      slot?.replace ??
      (same.length >= (formation?.[card.position] ?? 0)
        ? same[0]?.id
        : undefined);
    if (
      !eligibleForPosition(
        card,
        card.position,
        comp,
        data.user_id,
        picked,
        replacement,
      )
    )
      return;
    change([...ids.filter((id) => id !== replacement), card.id]);
    close();
  }
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("card");
    const card = data.cards.find((c) => c.id === id);
    if (card) setDetail(card);
  }, [data.cards]);
  const candidates =
    slot && comp
      ? data.cards.filter(
          (c) =>
            eligibleForPosition(
              c,
              slot.position,
              comp,
              data.user_id,
              picked,
              slot.replace,
            ) &&
            `${c.name} ${c.team}`
              .toLowerCase()
              .includes(search.toLowerCase()) &&
            (!tier || c.tier === tier),
        )
      : [];
  return (
    <div className="fantasy-play">
      <header className="play-heading">
        <div>
          <p className="eyebrow">YOUR CLUB · YOUR ROUND</p>
          <h1>Your club.</h1>
        </div>
        <label>
          Sport
          <select
            aria-label="Fantasy sport"
            value={sport}
            onChange={(e) => {
              if (!discard()) return;
              setSport(e.target.value);
              setChosen("");
              setDirty(false);
              setPointRound("");
              try {
                localStorage.setItem(
                  `docked-sport:${data.user_id}`,
                  e.target.value,
                );
              } catch {}
            }}
          >
            {fantasySports.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.ready ? "" : " · coming later"}
              </option>
            ))}
          </select>
        </label>
      </header>
      <p className="simulation-label">
        OWNER QA · FICTIONAL FOOTBALL · SIMULATED POINTS
      </p>
      {sport !== "football" ? (
        <section className="fantasy-panel">
          <h2>
            {fantasySports.find((s) => s.id === sport)?.name} team setup is not
            ready
          </h2>
          <p>
            Approved squad, position, bench and competition rules are not
            available as an active configuration. No football rules or simulated
            rankings are applied to this sport.
          </p>
          <Link href="/fantasy/social">Explore the community</Link>
        </section>
      ) : (
        <>
          <section className="play-summary">
            <div className="team-round">
              <div>
                <h2>
                  {data.members.find((m) => m.id === data.user_id)?.name &&
                  data.members.find((m) => m.id === data.user_id)?.name !==
                    "You"
                    ? `${data.members.find((m) => m.id === data.user_id)?.name}’s team`
                    : "Your Docked team"}
                </h2>
                <p>
                  {current
                    ? `Scoring round ${current.round}`
                    : "No scoring round yet"}
                </p>
              </div>
              <span className="round-tag">
                {current?.season ?? next?.season ?? "No season"}
              </span>
            </div>
            <div className="play-metrics">
              <div>
                <span>Weekly points</span>
                <strong>
                  {data.results.find(
                    (r) =>
                      r.user_id === data.user_id &&
                      r.competition_id === current?.id,
                  )?.score ?? "—"}
                </strong>
                <small>Current scoring round · simulated</small>
              </div>
              <div>
                <span>Season points</span>
                <strong>{seasonPoints ?? "—"}</strong>
                <small>All entered rounds · fantasy points</small>
              </div>
              <div>
                <span>Round rank</span>
                <strong>
                  {data.results.find(
                    (r) =>
                      r.user_id === data.user_id &&
                      r.competition_id === current?.id,
                  )?.rank
                    ? `#${data.results.find((r) => r.user_id === data.user_id && r.competition_id === current?.id)?.rank}`
                    : "—"}
                </strong>
                <small>QA competition only</small>
              </div>
            </div>
          </section>
          {view === "points" && next && (
            <div className="deadline-card">
              <span>Next lineup deadline · Round {next.round}</span>
              <strong>{localTime(next.locks_at)}</strong>
              <span>{countdown(next.locks_at, now)} · your local time</span>
            </div>
          )}
          <div className="play-actions">
            <button
              className={view === "team" ? "button" : ""}
              onClick={() => setView("team")}
            >
              Pick Team
            </button>
            <button
              className={view === "points" ? "button" : ""}
              onClick={() => setView("points")}
            >
              View Points
            </button>
            <Link className="button-secondary" href="/fantasy/cards">
              My Cards
            </Link>
          </div>
          <div className="play-workspace">
            <section className="team-workspace">
              <div className="field-toolbar">
                <div>
                  <h2>
                    {view === "team" ? "Next editable lineup" : "Round points"}
                  </h2>
                  <p>
                    {view === "team"
                      ? "Team selection is always free."
                      : "Saved lineup at lock · never today’s selection"}
                  </p>
                </div>
                <button aria-pressed={list} onClick={() => setList(!list)}>
                  {list ? "Field view" : "List view"}
                </button>
              </div>
              {view === "team" ? (
                <>
                  <label>
                    Competition
                    <select
                      aria-label="Competition"
                      value={comp?.id ?? ""}
                      onChange={(e) => {
                        if (!discard()) return;
                        setChosen(e.target.value);
                        setDirty(false);
                        setNotice("");
                      }}
                    >
                      <option value="" disabled>
                        Choose an available round
                      </option>
                      {rounds
                        .filter(
                          (c) => !c.scored_at && Date.parse(c.locks_at) > now,
                        )
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} · Round {c.round}
                          </option>
                        ))}
                    </select>
                  </label>
                  {comp && (
                    <div className="deadline-card">
                      <span>Next lineup deadline · Round {comp.round}</span>
                      <strong>{localTime(comp.locks_at)}</strong>
                      <span>
                        {countdown(comp.locks_at, now)} · your local time
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <label>
                    Scoring round
                    <select
                      aria-label="Scoring round"
                      value={viewed?.id ?? ""}
                      onChange={(e) => setPointRound(e.target.value)}
                    >
                      <option value="" disabled>
                        No locked rounds yet
                      </option>
                      {history.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · Round {c.round}
                          {c.scored_at ? " · scored" : " · awaiting scores"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="points-total">
                    <span>Round {viewed?.round ?? "—"} · simulated</span>
                    <strong>
                      {result?.score ?? "—"} <small>points</small>
                    </strong>
                    <span>
                      {result
                        ? `Rank #${result.rank} · ${result.championship_points} championship points`
                        : "No published score for your entry"}
                    </span>
                  </div>
                </>
              )}
              {!fieldFormation || (view === "points" && !displayed.length) ? (
                <div className="fantasy-empty">
                  <h3>
                    {view === "points"
                      ? "No saved scoring lineup available"
                      : "No editable competition available"}
                  </h3>
                  <p>
                    {view === "points"
                      ? "Your immutable lineup and points appear after entering a round. Player scores are never reconstructed from your current collection."
                      : "Your collection is safe. An approved round must be open before you can save a team."}
                  </p>
                  <Link href="/fantasy/cards">View your cards</Link>
                </div>
              ) : (
                <div
                  className={list ? "field-list" : "fantasy-field"}
                  aria-label={
                    view === "points"
                      ? "Historical points field"
                      : "Team selection field"
                  }
                >
                  {Object.entries(fieldFormation)
                    .filter(([, n]) => n > 0)
                    .map(([position, count]) => (
                      <div className="field-row" key={position}>
                        <span className="field-position">{position}</span>
                        <div className="field-players">
                          {Array.from({ length: count }, (_, index) => {
                            const card = displayed.filter(
                              (c) => c.position === position,
                            )[index];
                            const score = roundScores?.find(
                              (s) => s.player_id === card?.player_id,
                            )?.score;
                            return (
                              <button
                                key={`${position}${index}`}
                                className={`field-player ${card ? "" : "empty-slot"}`}
                                disabled={
                                  busy ||
                                  (!card && (view === "points" || locked))
                                }
                                aria-label={
                                  card
                                    ? `${card.name}, ${position}${view === "points" ? `, ${score ?? "unavailable"} points` : ". Select player options"}`
                                    : `Choose ${position} ${index + 1}`
                                }
                                onClick={() =>
                                  card ? setDetail(card) : openSlot(position)
                                }
                              >
                                <PlayerShirt card={card} />
                                <span
                                  className="field-player-name"
                                  title={card?.name}
                                >
                                  {card?.name ?? "Select player"}
                                </span>
                                <small>
                                  {view === "points"
                                    ? score === undefined
                                      ? "—"
                                      : `${score} pts`
                                    : card
                                      ? `${card.position} · ${card.status}`
                                      : position}
                                </small>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )}
              {view === "team" && comp && (
                <>
                  <section className="reserves">
                    <h3>Reserves / unselected cards</h3>
                    <p>
                      No scoring bench or automatic substitutions in the current
                      Docked XI rules. Tap an owned reserve to replace a player;
                      only the saved XI enters.
                    </p>
                    <div className="reserve-cards">
                      {data.cards
                        .filter(
                          (c) =>
                            !ids.includes(c.id) &&
                            c.sport === "football" &&
                            c.season === comp.season &&
                            !["retired", "delisted"].includes(c.status),
                        )
                        .map((c) => (
                          <button
                            key={c.id}
                            disabled={busy || locked}
                            onClick={() => setDetail(c)}
                          >
                            <PlayerShirt card={c} />
                            <span>{c.name}</span>
                            <small>{c.position}</small>
                          </button>
                        ))}
                    </div>
                    {!data.cards.some(
                      (c) =>
                        !ids.includes(c.id) &&
                        c.sport === "football" &&
                        c.season === comp.season,
                    ) && (
                      <p>
                        No unselected eligible cards. Explore your collection as
                        you earn more.
                      </p>
                    )}
                  </section>
                  <div className="lineup-save">
                    <div>
                      <strong>{ids.length}/11 selected</strong>
                      <p role="status">
                        {notice ||
                          `${dirty ? "Unsaved changes" : "Saved selection"} · no lineup fees`}
                      </p>
                    </div>
                    <button
                      className="button"
                      disabled={busy || locked || issues.length > 0 || !dirty}
                      onClick={async () => {
                        const response = await act("save_lineup", {
                          competition_id: comp.id,
                          cards: ids,
                        });
                        if (response !== null) {
                          setDirty(false);
                          setNotice(
                            "Team saved on the server. Competition entry confirmed.",
                          );
                        }
                      }}
                    >
                      {busy ? "Saving team…" : "Save Team"}
                    </button>
                  </div>
                  {issues.length > 0 && (
                    <ul
                      className="formation-issues"
                      aria-label="Formation requirements"
                    >
                      {issues.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  )}
                  {dirty && (
                    <button
                      onClick={() => {
                        setDirty(false);
                        setNotice("Restored the saved team.");
                      }}
                    >
                      Discard changes
                    </button>
                  )}
                  <details>
                    <summary>Competition rules & lock policy</summary>
                    <p>
                      {Object.entries(formation ?? {})
                        .map(([p, n]) => `${n} ${p}`)
                        .join(" · ")}
                      .{" "}
                      {comp.rules.duplicates
                        ? "Duplicate player cards allowed by this competition."
                        : "One card per player."}{" "}
                      All position, tier and eligibility rules are checked again
                      by the server.
                    </p>
                    <p>
                      Cards in unresolved locked lineups cannot transfer. After
                      settlement, a transfer never changes earned points. Hosted
                      transfers remain disabled.
                    </p>
                  </details>
                </>
              )}
            </section>
            <aside className="play-sidebar">
              <section className="fantasy-panel">
                <h2>
                  {data.release_channel === "beta"
                    ? "Beta championship standings"
                    : "Championship standings"}
                </h2>
                {data.leaderboard?.rows.length ? (
                  data.leaderboard.rows.map((row) => (
                    <div className="fantasy-row" key={row.id}>
                      <span>
                        {row.rank}. {row.name}
                      </span>
                      <strong>{row.points} pts</strong>
                    </div>
                  ))
                ) : (
                  <p>No published championship standings yet.</p>
                )}
                <p className="small-note">
                  Current release only · Up to 100 visible members. Private,
                  blocked and inactive accounts are excluded. Fictional QA
                  competition; no cash prize.
                </p>
              </section>
              <section className="fantasy-panel">
                <h2>
                  {data.cards.length
                    ? "Your collection"
                    : "Build your first team"}
                </h2>
                <p>
                  {data.cards.length
                    ? `${data.cards.filter((c) => c.sport === "football").length} football cards owned. Each has a permanent edition and serial.`
                    : "Claim and open your free Starter pack in Cards, then return to select your XI."}
                </p>
                <Link className="button" href="/fantasy/cards">
                  {data.cards.length
                    ? "Manage my cards"
                    : "Get started with Cards"}
                </Link>
              </section>
              <section className="fantasy-panel">
                <h2>Scoring, clearly separated</h2>
                <p>
                  Weekly and season fantasy points come from recorded
                  competition entries. Championship points reward round
                  placings. Daily gameplay rewards are separate.
                </p>
                <p>
                  Live sporting data and additional sport scoring are not
                  connected.
                </p>
              </section>
            </aside>
          </div>
        </>
      )}
      {slot && comp && (
        <FantasySheet title={`Choose ${slot.position}`} onClose={close}>
          <p>Owned cards · {comp.season} · selecting or replacing is free</p>
          <div className="selection-filters">
            <label>
              Search player or team
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your eligible cards"
              />
            </label>
            <label>
              Rarity
              <select value={tier} onChange={(e) => setTier(e.target.value)}>
                <option value="">All tiers</option>
                {["CORE", "RARE", "ELITE", "LEGENDARY", "ICON"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <p>
            {candidates.length} eligible cards · competition limits apply on
            save
          </p>
          <div className="player-picker">
            {candidates.map((c) => (
              <button
                key={c.id}
                disabled={busy || locked}
                onClick={() => add(c)}
              >
                <PlayerShirt card={c} />
                <span>
                  <strong>{c.name}</strong>
                  <small>
                    {c.team} · {c.position} · {c.status}
                  </small>
                  <small>
                    {c.tier} #{c.serial} / {c.max_supply}
                  </small>
                </span>
                <b>Select</b>
              </button>
            ))}
          </div>
          {!candidates.length && (
            <p>
              No eligible owned cards match. Change your filters or visit Cards.
            </p>
          )}
        </FantasySheet>
      )}
      {detail && (
        <FantasyPlayerDetails
          card={detail}
          state={data}
          roundId={view === "points" ? viewed?.id : undefined}
          onClose={close}
          onSelect={
            view === "team" &&
            comp &&
            !locked &&
            detail.owner_id === data.user_id
              ? () => {
                  const card = detail;
                  setDetail(null);
                  openSlot(
                    card.position,
                    ids.includes(card.id)
                      ? card.id
                      : picked.find((c) => c.position === card.position)?.id,
                  );
                  setSearch("");
                }
              : undefined
          }
          onBench={
            view === "team" && !locked && ids.includes(detail.id)
              ? () => {
                  change(ids.filter((id) => id !== detail.id));
                  close();
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
