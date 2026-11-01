"use client";
import { eligibleInRound, isFreeCore } from "@/core/free-core";
import { NavigationShortcut } from "./navigation-shortcut";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CollectibleViewer, type ViewerCard } from "./collectible-viewer";
import { sandboxCardView } from "@/core/sandbox-card-view";
import { nbaRarityWeeklyVersion } from "@/core/additional-sport-statistics";
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
import { CompetitionSwitch } from "./competition-switch";
import { competitionName, seasonLabel } from "@/core/competition-display";
import { usesApprovedAustralianSalary } from "@/core/approved-australian-rules";
import { competitionHref } from "@/core/prize-schedules";
import { rarityRule, rarities } from "@/core/card-rarity";
import { TeamNameSetup } from "./team-name-setup";

export function SportSandbox({
  initial,
  navigationPath = "/admin/sports",
  privateBeta = false,
  publicCustomer = false,
  apiPath = "/api/admin/sports-sandbox",
}: {
  initial: SandboxState;
  navigationPath?: string;
  privateBeta?: boolean;
  publicCustomer?: boolean;
  apiPath?: string;
}) {
  const [inspecting, setInspecting] = useState<ViewerCard | null>(null);
  const [state, setState] = useState(initial),
    [mode, setMode] = useState<"OPEN" | "SALARY_CAP">(() => {
      const q = new URLSearchParams(
        typeof location === "undefined" ? "" : location.search,
      );
      const requested = q.get("mode");
      return requested === "SALARY_CAP" || requested === "OPEN"
        ? requested
        : (initial.competitions.find(
            (c) => c.sport === initial.sport && c.id === q.get("competition"),
          )?.rules.mode ?? "OPEN");
    });
  const [round, setRound] = useState(() => {
      const q = new URLSearchParams(
        typeof location === "undefined" ? "" : location.search,
      );
      return (
        initial.competitions.find(
          (c) =>
            c.sport === initial.sport &&
            c.rules.mode === mode &&
            (c.id === q.get("competition") ||
              (!q.get("competition") &&
                c.season === q.get("season") &&
                c.round === Number(q.get("week")))),
        )?.id ?? ""
      );
    }),
    [list, setList] = useState(false),
    [slot, setSlot] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerRarity, setPickerRarity] = useState("");
  const [pickerLimit, setPickerLimit] = useState(30);
  const [picks, setPicks] = useState<SlotSelection[]>([]),
    [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useSportDraftGuard(dirty || busy);
  const readPath =
    apiPath === "/api/nba-beta"
      ? `${apiPath}?view=state`
      : `${apiPath}${apiPath.includes("?") ? "&view=state" : `?sport=${state.sport}`}`;
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
    .filter((c) => c.sport === state.sport && c.rules.mode === mode)
    .filter(
      (c) =>
        !state.competitions.some(
          (v) => v.rules.replaces_competition === c.id,
        ) ||
        state.entries.some((e) => e.competition_id === c.id) ||
        state.drafts.some((d) => d.competition_id === c.id),
    )
    .sort(
      (a, b) =>
        Number(b.rules.scoring_version === nbaRarityWeeklyVersion) -
          Number(a.rules.scoring_version === nbaRarityWeeklyVersion) ||
        Number(
          b.rules.lineup_version === nbaWeeklyConfiguration.formatVersion,
        ) -
          Number(
            a.rules.lineup_version === nbaWeeklyConfiguration.formatVersion,
          ) ||
        a.round - b.round,
    );
  const comp =
    rounds.find((c) => c.id === round) ??
    (publicCustomer || state.sport === "afl" || state.sport === "nrl"
      ? ([...rounds]
          .sort((a, b) => Date.parse(a.locks_at) - Date.parse(b.locks_at))
          .find((c) => Date.parse(c.locks_at) > serverNow) ?? rounds.at(-1))
      : rounds[0]);
  const roundWord = ["nfl", "basketball"].includes(state.sport)
    ? "Week"
    : "Round";
  const context = {
    sport: state.sport,
    mode,
    season: comp?.season,
    competition: comp?.id,
    week: comp ? String(comp.round) : undefined,
  };
  const contextHref = (path: string) => competitionHref(path, context);
  const roundIndex = rounds.findIndex((c) => c.id === comp?.id);
  function navigateRound(value: string, nextMode = mode) {
    if (busy || (dirty && !window.confirm("Discard unsaved lineup changes?")))
      return;
    setMode(nextMode);
    setRound(value);
    const next = state.competitions.find(
      (c) => c.id === value && c.rules.mode === nextMode,
    );
    history.replaceState(
      null,
      "",
      competitionHref(location.pathname, {
        sport: state.sport,
        mode: nextMode,
        competition: next?.id,
        season: next?.season,
        week: next ? String(next.round) : undefined,
      }),
    );
  }
  const appliedMultiplier =
    state.sport === "basketball" &&
    comp?.rules.scoring_version !== nbaRarityWeeklyVersion
      ? 1
      : undefined;
  const cfg = comp
    ? state.configurations[comp.rules.lineup_version]
    : undefined;
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
  const score = comp ? state.scores?.[comp.id] : undefined;
  const teamScore = score?.rows.find(
    (r) => r.user_id === (viewing?.user_id ?? state.user_id),
  );
  const [scoreError, setScoreError] = useState("");
  useEffect(() => {
    if (!locked) return;
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
          if (
            received.sport !== state.sport ||
            received.user_id !== state.user_id
          )
            throw Error("Sport context changed");
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
  const eligibleCards = state.cards.filter((c) => eligibleInRound(c, comp?.id));
  const hasRealRoster = eligibleCards.some(
    (c) => c.inventory_class === "real-roster-beta-v1",
  );
  const pickerCards = selected
    ? eligibleCards.filter(
        (c) =>
          c.owner_id === state.user_id &&
          c.sport === state.sport &&
          (!pickerRarity || c.tier === pickerRarity) &&
          (!hasRealRoster ||
            isFreeCore(c) ||
            c.inventory_class === "real-roster-beta-v1") &&
          `${c.name} ${c.team ?? ""}`
            .toLowerCase()
            .includes(pickerQuery.trim().toLowerCase()) &&
          fitsSlot(c, selected.positions) &&
          !picks.some(
            (p) =>
              p.slot !== slot &&
              (state.cards.find((v) => v.id === p.card)?.canonical_player_id ??
                state.cards.find((v) => v.id === p.card)?.player_id) ===
                (c.canonical_player_id ?? c.player_id),
          ),
      )
    : [];
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
    ? sevenIssues(mode, picks, eligibleCards, true, cfg)
    : null;
  const capPending =
    mode === "SALARY_CAP" &&
    (!cfg ||
      !Number.isSafeInteger(cfg.salaryCap) ||
      cfg.salaryCap <
        cfg.slots.length * Math.min(...Object.values(cfg.salaries)));
  const salaryDollars =
    (publicCustomer && state.sport === "nfl") ||
    nbaProposal ||
    usesApprovedAustralianSalary(cfg);
  async function command(
    action: "seven_draft" | "seven_enter" | "auto_select",
  ) {
    if (!comp || inFlight.current || (capPending && action !== "seven_draft"))
      return;
    if (privateBeta && !state.team_name && action !== "auto_select") {
      setError("Choose your permanent team name before saving or entering.");
      return;
    }
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
          action === "seven_enter" ? "Team entry confirmed" : "Draft saved",
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
  function renderCard(s: { id: string }) {
    const snap = display?.find((c) => c.slot === s.id);
    const selectedId = picks.find((p) => p.slot === s.id)?.card;
    const card: SandboxCard | undefined =
      snap ??
      state.cards.find((c) => c.id === selectedId) ??
      entry?.snapshot.find((c) => c.slot === s.id && c.card_id === selectedId);
    const playerScore = teamScore?.players.find(
      (p) => p.slot === s.id && p.card_id === (snap?.card_id ?? card?.id),
    );
    return (
      <>
        <button
          type="button"
          className="sport-card-button"
          data-card={card?.id ?? snap?.card_id}
          disabled={busy || (readOnly && !card)}
          onClick={() =>
            readOnly && card
              ? setInspecting(sandboxCardView(card))
              : setSlot(s.id)
          }
          aria-label={`${readOnly ? "View" : "Select"} ${s.id}${card ? `: ${card.name}` : ""}`}
        >
          {card ? (
            <CollectibleFace
              card={card}
              appliedMultiplier={appliedMultiplier}
              variant="lineup"
            />
          ) : (
            <span className="sport-empty-slot">
              <strong aria-hidden="true">+</strong>
              <span>{s.id}</span>
              <small>Select player</small>
            </span>
          )}
        </button>
        {card && readOnly && <span className="sport-lock-label">Locked</span>}
        {card && (
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
            <summary>Games this {roundWord.toLowerCase()}</summary>
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
                  base PTS · {game.status}
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
      <h1>Your lineup</h1>
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
      <details className="sport-beta-details">
        <summary>
          {publicCustomer
            ? comp?.fixture_kind === "practice"
              ? "Practice round · Free entry · No prizes"
              : "Free entry · No prizes"
            : "Test rounds · No prizes"}
          {!publicCustomer && state.sport !== "basketball"
            ? " · Provisional scoring"
            : ""}
        </summary>
        <p>
          {publicCustomer
            ? "Free Core eligibility is available in Play and does not issue collectible cards. Practice fixtures are labelled separately from official results. No entry fee or prize applies to these competitions."
            : privateBeta
              ? `${sport?.label ?? state.sport} testing · ${state.cards.some((c) => c.inventory_class === "real-roster-beta-v1") ? "Real-player roster cards; test rounds only. Real game statistics are not connected." : "Fictional players and simulated statistics."} ${state.sport === "basketball" ? "" : salaryDollars ? "Approved fantasy salaries; provisional scoring. " : "Provisional beta salary/scoring rules. "}No permanent cards or prizes.`
              : nbaProposal
                ? "PROPOSED NBA · Isolated testing with fictional cards and statistics. No member assets, prizes or live issuance."
                : "Isolated sandbox · Fictional QA cards · No member assets, credits or prizes. Salary units are test fixtures; scoring and live issuance are disabled."}
        </p>
      </details>
      <span className="competition-label">Competition</span>
      <CompetitionSwitch
        mode={mode}
        disabled={busy}
        salaryLabel={
          salaryDollars && cfg
            ? `$${(cfg.salaryCap / 1_000_000).toLocaleString("en-AU")}m salary cap`
            : cfg
              ? "Provisional test cap"
              : "Configuration pending"
        }
        onChange={(next) =>
          navigateRound(
            state.competitions.find(
              (c) =>
                c.sport === state.sport &&
                c.rules.mode === next &&
                c.season === comp?.season &&
                c.round === comp?.round,
            )?.id ?? "",
            next,
          )
        }
      />
      <div className="sport-entry-heading">
        <TeamNameSetup
          name={state.team_name}
          busy={busy}
          canChoose={privateBeta}
          onSave={async (name) => {
            if (inFlight.current || !privateBeta) return false;
            inFlight.current = true;
            setBusy(true);
            setError("");
            try {
              const response = await boundedFetch(
                publicCustomer ? apiPath : "/api/fantasy",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "name_team",
                    payload: { name },
                    request_id: crypto.randomUUID(),
                  }),
                },
              );
              const body = await response.json();
              if (!response.ok)
                throw Error(
                  body.error ?? "Unable to save team name. Please retry.",
                );
              const refreshed = await boundedFetch(readPath, {
                cache: "no-store",
              });
              if (!refreshed.ok)
                throw Error("Name saved. Refresh to continue.");
              const next = (await refreshed.json()).state as SandboxState;
              if (next.sport !== state.sport || next.user_id !== state.user_id)
                throw Error("Sport context changed");
              // Do not replace draft/card references and erase an unsaved lineup.
              setState((previous) => ({
                ...previous,
                team_name: next.team_name,
              }));
              return true;
            } catch (e) {
              setError(e instanceof Error ? e.message : "Unable to save name");
              return false;
            } finally {
              inFlight.current = false;
              setBusy(false);
            }
          }}
        />
        <span className="play-status">
          {locked
            ? entry
              ? "Entered · Locked"
              : "Not entered"
            : entry
              ? dirty
                ? "Entered · Unsaved changes"
                : savedChanges
                  ? "Entered · Draft changes saved"
                  : "Entered"
              : dirty
                ? "Unsaved draft"
                : "Draft"}
        </span>
      </div>
      {locked && <p className="small-note">Entry is closed for this round.</p>}
      <div className="sport-round-controls">
        <button
          aria-label={"Previous " + roundWord.toLowerCase()}
          disabled={busy || roundIndex <= 0}
          onClick={() => navigateRound(rounds[roundIndex - 1].id)}
        >
          ‹
        </button>
        <label>
          <span className="sr-only">Season and {roundWord.toLowerCase()}</span>
          <select
            aria-label="Round"
            value={comp?.id ?? ""}
            disabled={busy || !rounds.length}
            onChange={(e) => navigateRound(e.target.value)}
          >
            {rounds.length ? (
              rounds.map((c) => (
                <option key={c.id} value={c.id}>
                  {seasonLabel(c.season)} · {roundWord} {c.round}
                </option>
              ))
            ) : (
              <option value="">No configured rounds</option>
            )}
          </select>
        </label>
        <button
          aria-label={"Next " + roundWord.toLowerCase()}
          disabled={busy || roundIndex < 0 || roundIndex >= rounds.length - 1}
          onClick={() => navigateRound(rounds[roundIndex + 1].id)}
        >
          ›
        </button>
      </div>
      <div className="fantasy-actions">
        <NavigationShortcut
          compact
          icon="edge"
          href={contextHref("/fantasy/results")}
        >
          Rankings
        </NavigationShortcut>
        <NavigationShortcut
          compact
          icon="trophy"
          href={contextHref("/fantasy/prizes")}
        >
          Prizes
        </NavigationShortcut>
        {(state.sport === "afl" || state.sport === "nrl") && (
          <NavigationShortcut
            compact
            icon="feed"
            href={contextHref("/fantasy/scoring/how-it-works")}
          >
            Rules
          </NavigationShortcut>
        )}
        <button
          className="play-support"
          disabled={busy}
          onClick={() => void refresh()}
        >
          Refresh
        </button>
      </div>
      {comp && (
        <details className="sport-beta-details">
          <summary>Entry &amp; lock times</summary>
          <p>
            All selections lock{" "}
            <time dateTime={comp.locks_at}>
              {new Date(comp.locks_at).toLocaleString()}
            </time>
            .
          </p>
          <p>Drafts are private. Confirm your team before lockout.</p>
        </details>
      )}
      {!comp || !cfg ? (
        <p>No rounds are configured for this competition yet.</p>
      ) : (
        <>
          {state.continuity.rollovers
            .find((r) => r.competition_id === comp.id)
            ?.omitted.map((o) => (
              <p key={o.slot}>
                {o.slot}: {o.reason}
              </p>
            ))}
          {notice && <p role="status">{notice}</p>}
          {error && <p role="alert">{error}</p>}
          {(entry || locked) && (
            <section className="nba-week-summary" aria-label="Round score">
              <h2>
                {viewing
                  ? (teamScore?.name ?? "Community team")
                  : `${roundWord} ${comp.round}`}{" "}
                · {locked ? (score?.final ? "Final" : "Game Day") : "Upcoming"}
              </h2>
              <strong className="nba-total">
                {teamScore?.points == null
                  ? "—"
                  : (teamScore.points / 100).toFixed(2)}{" "}
                PTS
              </strong>
              <p>
                {teamScore?.played ?? 0}/{cfg.slots.length} played ·{" "}
                {teamScore?.completed ?? 0}/{cfg.slots.length} completed · Rank{" "}
                {teamScore?.rank == null ? "—" : `#${teamScore.rank}`}
              </p>
              <p>
                {!locked
                  ? "Games have not started"
                  : score?.final
                    ? "Final results"
                    : "Postgame scoring · Provisional"}
                {locked && score?.updatedAt
                  ? ` · Statistics updated ${new Date(score.updatedAt).toLocaleString()}`
                  : ""}
              </p>
              <p>
                All selections lock:{" "}
                <time dateTime={comp.locks_at}>
                  {new Date(comp.locks_at).toLocaleString()}
                </time>
              </p>

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
          {!readOnly &&
            picks.some((p) => !state.cards.some((c) => c.id === p.card)) && (
              <p role="status">
                Some saved selections are no longer in your collection. Replace
                them before saving.
              </p>
            )}
          <div className="sport-lineup-layout">
            <div>
              {" "}
              <SevenField
                sport={state.sport}
                label={`${sport?.label} ${viewing ? "community" : "own"} lineup`}
                slots={cfg.slots}
                list={list}
              >
                {renderCard}
              </SevenField>
            </div>
            <aside className="sport-team-summary fantasy-panel">
              <h2>Team summary</h2>
              <strong>
                {picks.length} / {cfg.slots.length} selected
              </strong>
              <dl>
                {sport.groups.map((g) => (
                  <div key={g.id}>
                    <dt>{g.label}</dt>
                    <dd>
                      {picks.filter((p) => g.slots.includes(p.slot)).length} /{" "}
                      {g.slots.length}
                    </dd>
                  </div>
                ))}
              </dl>
              <h3>{competitionName(mode)}</h3>
              {mode === "OPEN" ? (
                <p>No salary cap</p>
              ) : capPending ? (
                <p role="status">
                  Traditional salary configuration pending. Team entry is
                  unavailable.
                </p>
              ) : (
                <p>
                  {salaryDollars ? "$" : ""}
                  {(validate?.total ?? 0).toLocaleString("en-AU")} /{" "}
                  {cfg.salaryCap.toLocaleString("en-AU")}
                  {salaryDollars
                    ? " fantasy salary dollars"
                    : " test salary units"}
                </p>
              )}
              {mode === "SALARY_CAP" && salaryDollars && !capPending && (
                <div>
                  <label>
                    Salary budget used
                    <progress
                      max={cfg.salaryCap}
                      value={Math.min(validate?.total ?? 0, cfg.salaryCap)}
                    />
                  </label>
                  <p>
                    {(validate?.remaining ?? cfg.salaryCap).toLocaleString(
                      "en-AU",
                    )}{" "}
                    fantasy salary dollars remaining
                  </p>
                </div>
              )}
              {mode === "SALARY_CAP" && !salaryDollars && (
                <small>
                  Provisional beta configuration. A fantasy-dollar cap is not
                  approved.
                </small>
              )}
              {!readOnly &&
                validate?.errors.map((e) => (
                  <p className="form-help" key={e}>
                    {e}
                  </p>
                ))}
            </aside>
          </div>
          {!readOnly && (
            <div className="sport-save-actions">
              <button
                disabled={busy || !dirty}
                onClick={() => void command("seven_draft")}
              >
                Save draft
              </button>
              <button
                disabled={
                  busy ||
                  capPending ||
                  !!validate?.errors.length ||
                  (!dirty && !savedChanges && !!entry)
                }
                onClick={() => void command("seven_enter")}
              >
                {entry ? "Update Team" : "Enter Team"}
              </button>
            </div>
          )}
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
      {inspecting && (
        <CollectibleViewer
          card={inspecting}
          appliedMultiplier={appliedMultiplier}
          onClose={() => setInspecting(null)}
        />
      )}
      {slot && selected && (
        <FantasySheet
          title={`Select ${slot}`}
          onClose={() => setSlot(null)}
          historyEntry
        >
          <label>
            {eligibleCards.some(isFreeCore)
              ? "Find a player"
              : "Find in My Cards"}
            <input
              type="search"
              value={pickerQuery}
              onChange={(e) => {
                setPickerQuery(e.target.value);
                setPickerLimit(30);
              }}
              placeholder="Player or team"
            />
          </label>
          <label>
            Rarity
            <select
              value={pickerRarity}
              onChange={(e) => {
                setPickerRarity(e.target.value);
                setPickerLimit(30);
              }}
            >
              <option value="">All rarities</option>
              {rarities.map((r) => (
                <option key={r} value={r}>
                  {rarityRule(r).label}
                </option>
              ))}
            </select>
          </label>
          {mode === "SALARY_CAP" && cfg && (
            <p>
              Available: {validate?.remaining}{" "}
              {salaryDollars ? "salary dollars" : "test salary units"}
            </p>
          )}
          <div className="sport-review-grid">
            {pickerCards.slice(0, pickerLimit).map((c) => (
              <button
                key={c.id}
                aria-label={`Select ${c.name}`}
                disabled={c.listed || c.status !== "active"}
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
                  appliedMultiplier={appliedMultiplier}
                  variant="compact"
                />
                <span>{c.name}</span>
                {isFreeCore(c) && <small>Free Core · gameplay only</small>}
                <small>
                  {c.listed
                    ? "Listed for sale · cancel listing first"
                    : c.status !== "active"
                      ? (c.availability_reason ??
                        "Roster eligibility unavailable")
                      : mode === "SALARY_CAP" && cfg
                        ? `${cfg.salaries[c.tier as keyof typeof cfg.salaries].toLocaleString("en-AU")} ${salaryDollars ? "salary dollars" : "test salary units"}`
                        : "Eligible"}
                </small>
              </button>
            ))}
          </div>
          {!pickerCards.length && (
            <p>
              No eligible cards match this position and search.{" "}
              <Link href={`/fantasy/cards?sport=${state.sport}`}>
                View My Cards
              </Link>
            </p>
          )}
          {pickerLimit < pickerCards.length && (
            <button onClick={() => setPickerLimit((n) => n + 30)}>
              Show more players
            </button>
          )}
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
