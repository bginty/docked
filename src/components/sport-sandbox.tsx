"use client";
import { useEffect, useRef, useState } from "react";
import { SevenField } from "./seven-field";
import { CollectibleFace } from "./collectible-face";
import { FantasySheet } from "./fantasy-sheet";
import { fitsSlot, sevenIssues, type SlotSelection } from "@/core/nfl-seven";
import {
  sportConfigurations,
  sportActivationBlockers,
  nbaWeeklyConfiguration,
} from "@/core/sport-configuration";
import type { SandboxState, SandboxCard } from "@/core/sport-sandbox";
import { sandboxSelections } from "@/core/sport-lineup-view";
import { boundedFetch } from "@/core/bounded-request";
import type { autoSelect } from "@/core/lineup-auto-select";
import { useSportDraftGuard } from "./sport-context";

export function SportSandbox({
  initial,
  navigationPath = "/admin/sports",
  privateBeta = false,
  apiPath = "/api/admin/sports-sandbox",
}: {
  initial: SandboxState;
  navigationPath?: string;
  privateBeta?: boolean;
  apiPath?: string;
}) {
  const [state, setState] = useState(initial),
    [mode, setMode] = useState<"OPEN" | "SALARY_CAP">("OPEN");
  const [round, setRound] = useState(""),
    [list, setList] = useState(false),
    [slot, setSlot] = useState<string | null>(null);
  const [picks, setPicks] = useState<SlotSelection[]>([]),
    [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useSportDraftGuard(dirty || busy);
  const readPath =
    apiPath === "/api/nba-beta"
      ? `${apiPath}?view=state`
      : `${apiPath}?sport=${state.sport}`;
  const [proposal, setProposal] = useState<ReturnType<
      typeof autoSelect
    > | null>(null),
    [viewUser, setViewUser] = useState("");
  const inFlight = useRef(false);
  const request = useRef<{ payload: string; id: string } | null>(null);
  const [serverNow, setServerNow] = useState(Date.parse(initial.server_time));
  useEffect(() => {
    const at = performance.now(),
      server = Date.parse(state.server_time);
    setServerNow(server);
    const timer = setInterval(
      () => setServerNow(server + performance.now() - at),
      1000,
    );
    return () => clearInterval(timer);
  }, [state.server_time]);
  let sport = sportConfigurations[state.sport];
  const rounds = state.competitions
    .filter((c) => c.rules.mode === mode)
    .sort(
      (a, b) =>
        Number(
          b.rules.lineup_version === nbaWeeklyConfiguration.formatVersion,
        ) -
          Number(
            a.rules.lineup_version === nbaWeeklyConfiguration.formatVersion,
          ) || a.round - b.round,
    );
  const comp = rounds.find((c) => c.id === round) ?? rounds[0];
  const cfg = state.configurations[comp?.rules.lineup_version];
  const nbaProposal = cfg?.version === nbaWeeklyConfiguration.formatVersion;
  if (nbaProposal) sport = nbaWeeklyConfiguration;
  const entry = state.entries.find(
    (e) => e.competition_id === comp?.id && e.user_id === state.user_id,
  );
  const saved = state.drafts.find((d) => d.competition_id === comp?.id);
  const established = state.continuity.established[`${state.sport}:${mode}`];
  const locked = !!comp && Date.parse(comp.locks_at) <= serverNow;
  const savedChanges =
    !locked &&
    !!entry &&
    !!saved &&
    Date.parse(saved.updated_at) > Date.parse(entry.updated_at);
  const viewing = state.entries.find(
    (e) => e.competition_id === comp?.id && e.user_id === viewUser,
  );
  const readOnly = locked || !!viewing;
  const score = state.scores?.[comp?.id];
  const teamScore = score?.rows.find(
    (r) => r.user_id === (viewing?.user_id ?? state.user_id),
  );
  const [scoreError, setScoreError] = useState("");
  useEffect(() => {
    if (!nbaProposal || !locked) return;
    let disposed = false,
      pending = false;
    const poll = async () => {
      if (pending || inFlight.current || document.visibilityState !== "visible")
        return;
      pending = true;
      try {
        const r = await boundedFetch(readPath, { cache: "no-store" });
        if (!r.ok)
          throw Error(
            "Scores could not refresh. Last received scores are shown.",
          );
        const body = await r.json();
        if (!disposed) {
          const received = body.state as SandboxState;
          setState((previous) => ({
            ...previous,
            scores: received.scores,
            // Refresh authorised snapshots as the round locks, retaining stable
            // references so polling never resets the selected community team.
            entries: [
              ...previous.entries.filter((e) => e.competition_id !== comp?.id),
              ...received.entries
                .filter((e) => e.competition_id === comp?.id)
                .map((e) => {
                  const old = previous.entries.find(
                    (p) =>
                      p.competition_id === e.competition_id &&
                      p.user_id === e.user_id,
                  );
                  return old && JSON.stringify(old) === JSON.stringify(e)
                    ? old
                    : e;
                }),
            ],
          }));
          setScoreError("");
        }
      } catch {
        if (!disposed)
          setScoreError(
            "Scores could not refresh. Last received scores are shown.",
          );
      } finally {
        pending = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 30_000);
    const visible = () => void poll();
    document.addEventListener("visibilitychange", visible);
    return () => {
      disposed = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [nbaProposal, locked, comp?.id, state.sport]);
  const selected = slot && cfg?.slots.find((s) => s.id === slot);
  useEffect(() => {
    setPicks(sandboxSelections(entry, saved, locked));
    setDirty(false);
    setProposal(null);
    setSlot(null);
    setViewUser("");
    setError("");
  }, [comp?.id, entry, saved, locked]);
  useEffect(() => setNotice(""), [comp?.id]);
  useEffect(() => {
    const close = () => {
      setSlot(null);
      setProposal(null);
      setViewUser("");
    };
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, []);
  const display = viewing?.snapshot ?? (locked ? entry?.snapshot : null);
  const validate = cfg
    ? sevenIssues(mode, picks, state.cards, true, cfg)
    : null;
  async function command(
    action: "seven_draft" | "seven_enter" | "auto_select",
  ) {
    if (!comp || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = JSON.stringify({
        sport: state.sport,
        action,
        competition_id: comp.id,
        revision:
          action === "seven_draft"
            ? (saved?.revision ?? 0)
            : (entry?.revision ?? 0),
        selections: picks,
      });
      if (request.current?.payload !== payload)
        request.current = { payload, id: crypto.randomUUID() };
      const r = await boundedFetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport: state.sport,
          action,
          competition_id: comp.id,
          revision:
            action === "seven_draft"
              ? (saved?.revision ?? 0)
              : (entry?.revision ?? 0),
          selections: picks,
          request_id: request.current.id,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error ?? "Unable to save");
      request.current = null;
      if (action === "auto_select") setProposal(body.recommendation);
      else {
        setState(body.state);
        setDirty(false);
        setNotice(
          action === "seven_enter" ? "Sandbox entry confirmed" : "Draft saved",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  async function refresh() {
    if (
      inFlight.current ||
      (dirty && !window.confirm("Discard unsaved lineup changes?"))
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await boundedFetch(readPath, { cache: "no-store" });
      if (!r.ok)
        throw Error("Unable to refresh. Check sandbox access and retry.");
      setState((await r.json()).state);
      setNotice("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to refresh");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  function switchRound(value: string) {
    if (dirty && !window.confirm("Discard unsaved lineup changes?")) return;
    setRound(value);
  }
  function renderCard(s: { id: string }) {
    const snap = display?.find((c) => c.slot === s.id);
    const card: SandboxCard | undefined =
      snap ??
      state.cards.find(
        (c) => c.id === picks.find((p) => p.slot === s.id)?.card,
      );
    const playerScore = teamScore?.players.find(
      (p) => p.slot === s.id && p.card_id === (snap?.card_id ?? card?.id),
    );
    return (
      <>
        <button
          type="button"
          className="sport-card-button"
          data-card={card?.id ?? snap?.card_id}
          disabled={readOnly || busy}
          onClick={() => setSlot(s.id)}
          aria-label={`${readOnly ? "View" : "Select"} ${s.id}${card ? `: ${card.name}` : ""}`}
        >
          {card ? (
            <CollectibleFace
              card={card}
              appliedMultiplier={1}
              variant="lineup"
            />
          ) : (
            <span className="sport-empty-slot">Select player</span>
          )}
        </button>
        <p>{card?.name ?? "Empty position"}</p>
        {nbaProposal && card && (
          <p className="nba-player-score">
            <strong>
              {playerScore?.points == null
                ? "—"
                : (playerScore.points / 100).toFixed(2)}{" "}
              PTS
            </strong>
            <span>
              {playerScore?.status ??
                (locked ? "Awaiting postgame data" : "Not started")}
            </span>
          </p>
        )}
        {playerScore?.games.length ? (
          <details className="nba-game-breakdown">
            <summary>Games this week</summary>
            <ul>
              {playerScore.games.map((game, i) => (
                <li key={`${game.scheduledAt}:${i}`}>
                  <time dateTime={game.scheduledAt}>
                    {new Date(game.scheduledAt).toLocaleString()}
                  </time>
                  <br />
                  {game.points == null
                    ? "—"
                    : (game.points / 100).toFixed(2)}{" "}
                  PTS · {game.status}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </>
    );
  }
  return (
    <section className={`sport-sandbox${nbaProposal ? " nba-sandbox" : ""}`}>
      <h1>
        {sport?.label ?? state.sport} ·{" "}
        {privateBeta ? "Private beta" : "Team laboratory"}
      </h1>
      {!privateBeta && (
        <nav aria-label="Sandbox sport">
          {Object.values(sportConfigurations)
            .filter((c) => !c.publicEnabled)
            .map((c) => (
              <a
                key={c.id}
                href={`${navigationPath}?sport=${c.id}`}
                aria-current={state.sport === c.id ? "page" : undefined}
                onClick={(e) => {
                  if (
                    busy ||
                    (dirty &&
                      !window.confirm("Discard unsaved lineup changes?"))
                  )
                    e.preventDefault();
                }}
              >
                {c.label}
                {c.formatStatus === "proposal" ? " · Proposed" : ""}
              </a>
            ))}
        </nav>
      )}
      <p className="sport-sandbox-notice">
        {privateBeta
          ? `${sport?.label ?? state.sport} testing · Fictional players and simulated statistics. ${state.sport === "basketball" ? "" : "Provisional beta salary/scoring rules. "}No permanent cards or prizes.`
          : nbaProposal
            ? "PROPOSED NBA · Isolated testing with fictional cards and statistics. No member assets, prizes or live issuance."
            : "Isolated sandbox · Fictional QA cards · No member assets, credits or prizes. Salary units are test fixtures; scoring and live issuance are disabled."}
      </p>
      <div className="sport-sandbox-controls">
        <label>
          Competition{" "}
          <select
            aria-label="Competition"
            value={mode}
            disabled={busy}
            onChange={(e) => {
              if (dirty && !window.confirm("Discard unsaved lineup changes?"))
                return;
              setMode(e.target.value as typeof mode);
              setRound("");
            }}
          >
            <option value="SALARY_CAP">
              {nbaProposal
                ? `Salary Cap · ${privateBeta ? "" : "Proposed "}$5.2m`
                : "Salary Cap · QA units"}
            </option>
            <option value="OPEN">{nbaProposal ? "Open" : "All-Star"}</option>
          </select>
        </label>
        <label>
          Round{" "}
          <select
            aria-label="Round"
            value={comp?.id ?? ""}
            disabled={busy}
            onChange={(e) => switchRound(e.target.value)}
          >
            {rounds.map((c) => (
              <option key={c.id} value={c.id}>
                Round {c.round}
                {state.sport === "basketball"
                  ? c.rules.lineup_version ===
                    nbaWeeklyConfiguration.formatVersion
                    ? " · Eight-position testing"
                    : " · Legacy format"
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <button disabled={busy} onClick={() => void refresh()}>
          Refresh
        </button>
        <strong>
          {viewing
            ? "Community team"
            : locked
              ? "Locked"
              : entry
                ? dirty
                  ? "Entered · Unsaved changes"
                  : savedChanges
                    ? "Entered · Draft changes saved"
                    : "Entered"
                : dirty
                  ? "Unsaved draft"
                  : "Draft"}
        </strong>
      </div>
      {!comp || !cfg ? (
        <p>
          No isolated rounds registered. An authorised operator must install
          reviewed sandbox fixtures.
        </p>
      ) : (
        <>
          <p>
            {picks.length}/{cfg.slots.length} selected
            {mode === "SALARY_CAP"
              ? nbaProposal
                ? ` · $${(validate?.total ?? 0).toLocaleString("en-AU")} / $${cfg.salaryCap.toLocaleString("en-AU")}`
                : ` · ${validate?.total ?? 0}/${cfg.salaryCap} QA salary units`
              : ""}
          </p>
          {!readOnly && (!entry || dirty || savedChanges) && (
            <div className="sport-sandbox-controls">
              <button
                disabled={busy || !dirty}
                onClick={() => void command("seven_draft")}
              >
                Save draft
              </button>
              <button
                disabled={
                  busy ||
                  !!validate?.errors.length ||
                  (!dirty && !savedChanges && !!entry)
                }
                onClick={() => void command("seven_enter")}
              >
                Confirm sandbox entry
              </button>
            </div>
          )}
          {state.continuity.rollovers
            .find((r) => r.competition_id === comp.id)
            ?.omitted.map((o) => (
              <p key={o.slot}>
                {o.slot}: {o.reason}
              </p>
            ))}
          {notice && <p role="status">{notice}</p>}
          {error && <p role="alert">{error}</p>}
          {nbaProposal && (
            <section className="nba-week-summary" aria-label="NBA weekly score">
              <h2>
                {viewing
                  ? (teamScore?.name ?? "Community team")
                  : `Week ${comp.round}`}{" "}
                · {locked ? (score?.final ? "Final" : "Game Day") : "Upcoming"}
              </h2>
              <strong className="nba-total">
                {teamScore?.points == null
                  ? "—"
                  : (teamScore.points / 100).toFixed(2)}{" "}
                PTS
              </strong>
              <p>
                {teamScore?.played ?? 0}/8 played · {teamScore?.completed ?? 0}
                /8 week complete · Rank{" "}
                {teamScore?.rank == null ? "—" : `#${teamScore.rank}`}
              </p>
              <p>
                {!locked
                  ? "Games have not started"
                  : score?.final
                    ? "Final results"
                    : "Postgame scoring · Provisional"}
                {score?.updatedAt
                  ? ` · Statistics updated ${new Date(score.updatedAt).toLocaleString()}`
                  : ""}
              </p>
              <p>
                All selections lock:{" "}
                <time dateTime={comp.locks_at}>
                  {new Date(comp.locks_at).toLocaleString()}
                </time>
              </p>
              <a className="button ghost" href="#nba-rankings">
                View Rankings
              </a>
              {scoreError && <p role="status">{scoreError}</p>}
            </section>
          )}
          <div className="nba-field-actions">
            {!readOnly &&
              !established &&
              !saved?.selections.length &&
              !dirty && (
                <button
                  disabled={busy}
                  onClick={() => void command("auto_select")}
                >
                  Auto Select
                </button>
              )}
            <button
              className="nba-view-toggle"
              type="button"
              onClick={() => setList(!list)}
            >
              {list ? "Field view" : "List view"}
            </button>
          </div>
          <SevenField
            sport={state.sport}
            label={`${sport?.label} ${viewing ? "community" : "own"} lineup`}
            slots={cfg.slots}
            list={list}
          >
            {renderCard}
          </SevenField>
          <section aria-label="Community teams">
            <h2>Community teams</h2>
            {state.entries
              .filter(
                (e) =>
                  e.competition_id === comp.id && e.user_id !== state.user_id,
              )
              .map((e) => (
                <button key={e.user_id} onClick={() => setViewUser(e.user_id)}>
                  View locked team
                </button>
              ))}
            {!locked && (
              <p>
                Other submitted teams become visible to competitors after round
                lock.
              </p>
            )}
            {viewing && (
              <button onClick={() => setViewUser("")}>Back to my team</button>
            )}
          </section>
          {nbaProposal && (
            <section
              id="nba-rankings"
              className="nba-rankings"
              aria-label="Weekly rankings"
            >
              <h2>Weekly Rankings</h2>
              {!score?.rows.length ? (
                <p>
                  {locked
                    ? "Waiting for the first postgame results."
                    : "Rankings open after the weekly lockout."}
                </p>
              ) : (
                <ul>
                  {score.rows.map((r) => (
                    <li
                      key={r.user_id}
                      data-current={r.user_id === state.user_id}
                    >
                      <button
                        onClick={() => {
                          setViewUser(
                            r.user_id === state.user_id ? "" : r.user_id,
                          );
                          setList(true);
                        }}
                        aria-label={`View ${r.name} team`}
                      >
                        <span>
                          {r.rank == null ? "—" : `#${r.rank}`} · {r.name}
                          {r.user_id === state.user_id ? " · You" : ""}
                        </span>
                        <strong>
                          {r.points == null ? "—" : (r.points / 100).toFixed(2)}{" "}
                          PTS
                        </strong>
                        <span>
                          {r.played}/8 played · {r.completed}/8 week complete
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {viewing && (
                <button
                  onClick={() => {
                    setViewUser("");
                    document.getElementById("nba-rankings")?.scrollIntoView();
                  }}
                >
                  Back to Rankings
                </button>
              )}
            </section>
          )}
        </>
      )}
      {slot && selected && (
        <FantasySheet
          title={`Select ${slot}`}
          onClose={() => setSlot(null)}
          historyEntry
        >
          <div className="sport-review-grid">
            {state.cards
              .filter(
                (c) =>
                  c.owner_id === state.user_id &&
                  c.sport === state.sport &&
                  c.status === "active" &&
                  !c.listed &&
                  fitsSlot(c, selected.positions) &&
                  !picks.some(
                    (p) =>
                      p.slot !== slot &&
                      state.cards.find((v) => v.id === p.card)?.player_id ===
                        c.player_id,
                  ),
              )
              .map((c) => (
                <button
                  key={c.id}
                  aria-label={`Select ${c.name}`}
                  onClick={() => {
                    setPicks([
                      ...picks.filter((p) => p.slot !== slot),
                      { slot, card: c.id },
                    ]);
                    setDirty(true);
                    setSlot(null);
                  }}
                >
                  <CollectibleFace
                    card={c}
                    appliedMultiplier={1}
                    variant="compact"
                  />
                  <span>{c.name}</span>
                </button>
              ))}
          </div>
        </FantasySheet>
      )}
      {proposal && (
        <FantasySheet
          title="Review Auto Select"
          onClose={() => setProposal(null)}
          historyEntry
        >
          <p>
            {proposal.picks.length} positions filled.{" "}
            {proposal.unranked.length
              ? "Some cards have no prior performance evidence; unranked cards use deterministic eligibility and salary ordering."
              : "Ranked by the latest five scored games before this week, within the salary and position rules."}
          </p>
          {proposal.missing.length > 0 && (
            <p>Missing: {proposal.missing.join(", ")}</p>
          )}
          <ul>
            {proposal.picks.map((p) => (
              <li key={p.slot}>
                {p.slot}: {state.cards.find((c) => c.id === p.card)?.name}
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              setPicks(proposal.picks);
              setDirty(true);
              setProposal(null);
            }}
          >
            Apply lineup
          </button>
          <button onClick={() => setProposal(null)}>Cancel</button>
        </FantasySheet>
      )}
      {sport && !privateBeta && (
        <details>
          <summary>Activation requirements</summary>
          <ul>
            {sportActivationBlockers(sport).map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
