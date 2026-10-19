"use client";
import { useSportDraftGuard } from "./sport-context";
import { roundProgress } from "@/core/round-status";
import { competitionName, competitionLabel } from "@/core/competition-display";
import { slotPool, filterSlotPool } from "@/core/lineup-picker";
import { CollectibleFace } from "./collectible-face";
import { rarityFrame, rarityStyle } from "@/core/rarity-theme";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { competitionHref } from "@/core/prize-schedules";

import {
  availability,
  cardIdentity,
  sevenEligibility,
} from "@/core/card-display";

import { useCallback, useEffect, useState } from "react";

import type { FantasyCard, FantasyState } from "@/core/fantasy";

import {
  nflSeven,
  salary,
  sevenIssues,
  restoreLockedSelections,
  type NflMode,
  type SlotSelection,
} from "@/core/nfl-seven";

import { rarities, rarityRule } from "@/core/card-rarity";

import {
  FantasyPlayerDetails,
  FantasySheet,
  PlayerShirt,
} from "./fantasy-player-sheet";

import { teamFilter } from "@/core/card-presentation";

import { LocalDateTime } from "./local-date-time";
import { CompetitionWeekSelector } from "./competition-week-selector";
import { WeeklyLineupResult } from "./weekly-lineup-result";
import type { autoSelect } from "@/core/lineup-auto-select";
import { boundedFetch } from "@/core/bounded-request";
import { hasEstablishedTeam } from "@/core/team-continuity";

function FantasyAmount({ value }: { value: number }) {
  const exact = value.toLocaleString("en-AU");
  const compact =
    Math.abs(value) >= 1_000_000
      ? (value / 1_000_000).toFixed(2) + "m"
      : Math.abs(value) >= 1000
        ? (value / 1000).toLocaleString("en-AU", { maximumFractionDigits: 1 }) +
          "k"
        : exact;
  return (
    <span
      title={exact + " fantasy salary dollars"}
      aria-label={exact + " fantasy salary dollars"}
    >
      $ {compact}
    </span>
  );
}
type Draft = {
  picks: SlotSelection[];

  revision: number;

  entryRevision: number;

  dirty: boolean;
};

export function NflSevenPlay({
  data,

  busy,

  act,

  mode,
}: {
  data: FantasyState;

  busy: boolean;

  mode: NflMode;

  act: (
    action: string,

    payload?: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null>;
}) {
  const navigationQuery = useSearchParams();
  const [autoBusy, setAutoBusy] = useState(false);
  const [recommendation, setRecommendation] = useState<null | {
    competition: string;
    original: string;
    result: ReturnType<typeof autoSelect>;
    asOf: string | null;
  }>(null);
  const [chosen, setChosen] = useState(""),
    [drafts, setDrafts] = useState<Record<string, Draft>>({}),
    [slot, setSlot] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [team, setTeam] = useState(""),
    [tier, setTier] = useState(""),
    [position, setPosition] = useState(""),
    [sort, setSort] = useState("name"),
    [notice, setNotice] = useState(""),
    [list, setList] = useState(false);

  const [teamName, setTeamName] = useState(data.team_name ?? "");
  const [editingName, setEditingName] = useState(false);
  const [pickerPage, setPickerPage] = useState(1);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setChosen(params.get("competition") ?? "");
  }, [navigationQuery.toString()]);
  function openSlot(id: string) {
    setSlot(id);
    setSearch("");
    setTeam("");
    setTier("");
    setPosition("");
    setSort("name");
    setPickerPage(1);
  }
  useEffect(() => {
    setPickerPage(1);
  }, [search, team, tier, position, sort]);
  const [profile, setProfile] = useState<{
    card: string;
    slot: string;
    candidate: boolean;
  } | null>(null);
  const closeProfile = useCallback(() => setProfile(null), []);

  const [now, setNow] = useState(
    Date.parse(data.seven?.server_time ?? new Date().toISOString()),
  );

  useEffect(() => {
    const server = Date.parse(
        data.seven?.server_time ?? new Date().toISOString(),
      ),
      local = Date.now();

    const tick = () => setNow(server + Date.now() - local);

    tick();

    const timer = setInterval(tick, 1000);

    return () => clearInterval(timer);
  }, [data.seven?.server_time]);

  const rounds = data.competitions

    .filter((c) => c.rules.mode === mode && c.rules.lineup_version)

    .sort((a, b) => Date.parse(a.locks_at) - Date.parse(b.locks_at));

  const comp =
    rounds.find((c) => c.id === chosen) ??
    rounds.find(
      (c) =>
        c.season === navigationQuery.get("season") &&
        String(c.round) === navigationQuery.get("week"),
    ) ??
    rounds.find((c) => Date.parse(c.locks_at) > now) ??
    rounds.at(-1);

  const publishedConfig =
    data.seven?.configurations[String(comp?.rules.lineup_version)];
  const cfg = publishedConfig ?? nflSeven;
  const established = hasEstablishedTeam(data, comp?.sport ?? "nfl", mode);
  const rollover = data.seven?.rollovers?.find(
    (r) => r.competition_id === comp?.id,
  );

  const entry = data.seven?.entries.find((e) => e.competition_id === comp?.id),
    saved = data.seven?.drafts.find((d) => d.competition_id === comp?.id);

  const storage = `docked-seven:${data.user_id}`;

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("competition");

    if (id) setChosen(id);
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storage);

      setDrafts(raw ? JSON.parse(raw) : {});
    } catch {}
  }, [storage]);

  useEffect(() => {
    if (!comp) return;

    setDrafts((old) =>
      // A new automatic draft may appear while this tab holds an unsaved plan.
      // Rebase only the untouched rollover's first revision, never another saved edit.
      old[comp.id]?.dirty &&
      old[comp.id].revision === 0 &&
      rollover &&
      !entry &&
      saved?.revision === 1 &&
      JSON.stringify(saved.selections) === JSON.stringify(rollover.selections)
        ? { ...old, [comp.id]: { ...old[comp.id], revision: 1 } }
        : old[comp.id] &&
            (old[comp.id].dirty ||
              (old[comp.id].revision === (saved?.revision ?? 0) &&
                old[comp.id].entryRevision === (entry?.revision ?? 0)))
          ? old
          : {
              ...old,

              [comp.id]: {
                picks:
                  entry?.snapshot.map((c) => ({
                    slot: c.slot,

                    card: c.card_id,
                  })) ??
                  saved?.selections ??
                  [],

                revision: saved?.revision ?? 0,

                entryRevision: entry?.revision ?? 0,

                dirty: false,
              },
            },
    );
  }, [comp, saved, entry, rollover]);

  const update = (next: Draft) => {
    if (!comp) return;

    setDrafts((old) => {
      const result = { ...old, [comp.id]: next };

      try {
        sessionStorage.setItem(storage, JSON.stringify(result));
      } catch {}

      return result;
    });
  };

  const draft = comp ? drafts[comp.id] : undefined,
    draftPicks = draft?.picks ?? [];

  useSportDraftGuard(Boolean(draft?.dirty));

  const fixtures = data.seven?.fixtures[comp?.id ?? ""] ?? [];

  const kickoff = (c: FantasyCard) =>
    fixtures.find((f) =>
      f.playerIds.includes(c.canonical_player_id ?? c.player_id),
    );

  const locks = new Map(
    (entry?.snapshot ?? [])

      .filter(
        (c) =>
          !!comp?.scored_at ||
          Date.parse(c.kickoff) <= now ||
          data.seven?.locks.some(
            (l) => l.competition_id === comp?.id && l.slot === c.slot,
          ),
      )

      .map((c) => [c.slot, c]),
  );

  const inventory = [...(data.seven?.inventory ?? [])];

  const historical =
    !!comp?.scored_at ||
    (!!entry && locks.size === entry.snapshot.length && locks.size > 0);
  const picks = restoreLockedSelections(
    historical
      ? (entry?.snapshot.map((c) => ({ slot: c.slot, card: c.card_id })) ?? [])
      : draftPicks,

    [...locks.values()].map((c) => ({ slot: c.slot, card: c.card_id })),
  );

  const restoredLocks = [...locks.values()].some(
    (c) => draftPicks.find((p) => p.slot === c.slot)?.card !== c.card_id,
  );

  for (const c of locks.values()) {
    const index = inventory.findIndex((x) => x.id === c.card_id);

    const historic = { ...c, id: c.card_id, status: "active", listed: false };

    if (index >= 0) inventory[index] = historic;
    else inventory.push(historic);
  }

  const check = sevenIssues(mode, picks, inventory, false, cfg),
    full = sevenIssues(mode, picks, inventory, true, cfg);

  for (const pick of picks) {
    if (locks.has(pick.slot)) continue;

    const card = inventory.find((c) => c.id === pick.card);

    if (card) {
      const reason = sevenEligibility(card, data, comp?.id ?? "");
      if (reason) {
        check.errors.push(`${card.name}: ${reason}`);
        full.errors.push(`${card.name}: ${reason}`);
      }
    }
  }

  const normalize = (ps: SlotSelection[]) =>
    JSON.stringify([...ps].sort((a, b) => a.slot.localeCompare(b.slot)));

  const notSubmitted =
    !!entry &&
    normalize(picks) !==
      normalize(entry.snapshot.map((c) => ({ slot: c.slot, card: c.card_id })));

  const draftState = check.errors.length
    ? "Action required"
    : locks.size === cfg.slots.length
      ? "Fully locked"
      : locks.size
        ? "Partially locked"
        : draft?.dirty
          ? "Unsaved changes"
          : notSubmitted
            ? "Changes not submitted"
            : entry
              ? "Entered"
              : saved || draft?.revision
                ? `Saved draft — ${picks.length}/${cfg.slots.length}${picks.length < cfg.slots.length ? " · incomplete" : ""}`
                : "No saved draft";

  const closed = !!comp && Date.parse(comp.locks_at) <= now,
    editable =
      !!comp &&
      !!publishedConfig &&
      !historical &&
      (!closed || !!entry) &&
      !comp.rules.disabled;
  const entryOpensLater = !!comp?.opens_at && Date.parse(comp.opens_at) > now;

  function selectWeek(id: string) {
    const target = rounds.find((c) => c.id === id);
    if (!target) return;
    setChosen(id);
    setRecommendation(null);
    setProfile(null);
    setSlot(null);
    setNotice("");
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries({
      competition: id,
      season: target.season,
      week: String(target.round),
      mode,
      sport: "nfl",
    }))
      url.searchParams.set(k, v);
    window.history.pushState(null, "", url);
  }
  async function recommend() {
    if (!comp || !editable || autoBusy || established) return;
    setAutoBusy(true);
    setNotice("");
    try {
      const response = await boundedFetch(
        `/api/fantasy/auto-select?competition=${encodeURIComponent(comp.id)}`,
        { cache: "no-store" },
      );
      const body = await response.json();
      if (!response.ok)
        throw Error(body.error || "Auto Select is unavailable.");
      if (body.member !== data.user_id || body.competition !== comp.id)
        throw Error("Account or competition changed. Please retry.");
      const result = body.recommendation as ReturnType<typeof autoSelect>;
      if (
        !result ||
        !Array.isArray(result.picks) ||
        !Array.isArray(result.missing) ||
        !Array.isArray(result.unranked)
      )
        throw Error("Recommendation unavailable. Please retry.");
      setRecommendation({
        competition: comp.id,
        original: normalize(picks),
        result,
        asOf: body.asOf,
      });
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : "Auto Select failed. Your lineup is unchanged.",
      );
    } finally {
      setAutoBusy(false);
    }
  }

  const nextLock = (
    entry
      ? entry.snapshot.map((card) => card.kickoff)
      : picks.map((pick) => {
          const card = inventory.find((c) => c.id === pick.card);
          return card ? kickoff(card)?.scheduledAt : undefined;
        })
  )
    .filter((t): t is string => !!t && Date.parse(t) > now)
    .sort()[0];

  const close = useCallback(() => setSlot(null), []);

  function candidate(c: FantasyCard) {
    if (!slot) return "";

    const unavailable = availability(c);
    if (unavailable) return unavailable;

    if (locks.has(slot)) return "This slot is locked";

    const f = kickoff(c);

    if (!f?.scheduledAt || (f.status && f.status !== "scheduled"))
      return "Fixture unavailable or under review";

    if (Date.parse(f.scheduledAt) <= now) return "Game started";

    return (
      sevenIssues(
        mode,

        [...picks.filter((p) => p.slot !== slot), { slot, card: c.id }],

        inventory,

        false,

        cfg,
      ).errors[0] ?? ""
    );
  }

  async function save(
    action: "seven_draft" | "seven_enter" | "seven_withdraw",
  ) {
    if (!comp || !draft) return;

    const out = await act(action, {
      competition_id: comp.id,

      revision: action === "seven_draft" ? draft.revision : draft.entryRevision,

      selections: action === "seven_withdraw" ? [] : picks,
    });

    if (!out) {
      setNotice(
        "Not saved. Review the error above; refresh if another window changed this team. Your draft is retained.",
      );

      return;
    }

    update({
      ...draft,

      picks,

      dirty: false,

      ...(action === "seven_draft"
        ? { revision: Number(out.revision) }
        : {
            entryRevision:
              action === "seven_withdraw" ? 0 : Number(out.revision),
          }),
    });

    setNotice(
      action === "seven_draft"
        ? "Draft saved. Your competition entry has not changed."
        : action === "seven_enter"
          ? "Entry confirmed. Your submitted team is saved."
          : "Entry withdrawn. Your draft is retained.",
    );
  }

  if (!comp || !data.seven)
    return (
      <section className="fantasy-panel">
        <h2>{competitionName(mode)}</h2>

        <p>No verified upcoming round is available yet.</p>
      </section>
    );

  const pool = slot
    ? slotPool(data.seven.inventory, data.user_id, comp, slot, cfg)
    : [];
  const filtered = filterSlotPool(pool, { search, team, tier, position }).sort(
    (a, b) => {
      const availabilityOrder = Number(!!candidate(a)) - Number(!!candidate(b));
      return (
        availabilityOrder ||
        (sort === "salary"
          ? salary(a.tier, cfg) - salary(b.tier, cfg)
          : sort === "rarity"
            ? rarityRule(b.tier).multiplierTenths -
              rarityRule(a.tier).multiplierTenths
            : a.name.localeCompare(b.name)) ||
        a.id.localeCompare(b.id)
      );
    },
  );
  const page = Math.min(
    pickerPage,
    Math.max(1, Math.ceil(filtered.length / 20)),
  );
  const teams = [
    ...new Map(
      pool.map((c) => {
        const t = teamFilter(c.team);
        return [t.key, t];
      }),
    ).values(),
  ].sort((a, b) => a.label.localeCompare(b.label));
  return (
    <section className="fantasy-play seven-play">
      <header className="play-heading compact-entry-heading">
        <div className="lineup-team-name">
          <small>Team name</small>
          <strong>{data.team_name || "Unnamed team"}</strong>
          {!data.team_name && (
            <button
              className="play-support"
              aria-label="Choose team name"
              onClick={() => setEditingName(!editingName)}
            >
              Choose name
            </button>
          )}
          {editingName && !data.team_name && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const result = await act("name_team", {
                  name: teamName.trim(),
                });
                if (result) setEditingName(false);
              }}
            >
              <label>
                Team name
                <input
                  value={teamName}
                  maxLength={40}
                  onChange={(e) => setTeamName(e.target.value)}
                  required
                />
              </label>
              <p className="small-note">
                Choose carefully. Your team name is permanent.
              </p>
              <button disabled={busy || !teamName.trim()}>Save name</button>
            </form>
          )}
        </div>
        <span className="entry-badge" role="status">
          {draftState}
        </span>
      </header>
      <CompetitionWeekSelector
        rounds={rounds}
        selected={comp.id}
        onSelect={selectWeek}
      />
      {rounds.length === 1 && (
        <p className="small-note">
          Only this competition week is published so far. Future weeks appear
          when their fixtures and rules are verified.
        </p>
      )}
      {closed && !entry && (
        <p role="status">
          No submitted lineup is recorded for this week. A saved draft is not a
          historical entry.
        </p>
      )}
      {historical && (
        <p role="status">
          Saved competition entry · read-only. Selections and locked card
          details are preserved independently of current ownership.
        </p>
      )}

      <Link
        className="play-support"
        href={competitionHref("/fantasy/prizes", {
          ...Object.fromEntries(navigationQuery.entries()),
          sport: "nfl",
          mode,
          competition: comp.id,
          season: comp.season,
          week: String(comp.round),
        })}
      >
        🏆 Prizes
      </Link>
      <div className="round-timing">
        {entryOpensLater && (
          <p>
            Draft planning is available. Entries open{" "}
            <LocalDateTime value={comp.opens_at!} />.
          </p>
        )}{" "}
        <strong>
          {closed ? "New entries closed" : "Entry deadline"}{" "}
          <LocalDateTime value={comp.locks_at} />
        </strong>
        <p>
          {nextLock ? (
            <>
              {entry ? "Next player lock" : "Next selected kickoff"}:{" "}
              <LocalDateTime value={nextLock} />
            </>
          ) : (
            "Each submitted player locks at their own kickoff."
          )}
        </p>
      </div>
      {rollover && (
        <div className="lineup-continuity" role="status">
          <p>
            Your team was carried forward from{" "}
            {data.competitions.find(
              (c) => c.id === rollover.source_competition_id,
            )?.name ?? "the previous week"}{" "}
            as a draft. Review and enter this week separately.
          </p>
          {!!rollover.omitted.length && (
            <details>
              <summary>Positions needing review when carried forward</summary>
              <ul>
                {rollover.omitted.map((o) => (
                  <li key={o.slot}>
                    {o.slot}: {o.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {!established ? (
        <div className="lineup-auto-actions">
          <button
            className="play-support"
            disabled={busy || autoBusy || !editable}
            onClick={() => void recommend()}
          >
            {autoBusy ? "Finding your lineup…" : "Auto Select"}
          </button>
          <small>
            Build your first team from eligible owned cards. After your first
            confirmed entry, make changes manually.
          </small>
        </div>
      ) : (
        <p className="small-note">
          Your team is established. Select an unlocked position to replace one
          player. New cards are never added automatically.
        </p>
      )}
      <div className="lineup-workspace">
        <div className="lineup-pitch">
          {" "}
          <div className="field-toolbar">
            <h2>QB · 2 RB · 2 WR · TE · FLEX</h2>
            <button onClick={() => setList(!list)} aria-pressed={list}>
              {list ? "Field view" : "List view"}
            </button>
          </div>
          {restoredLocks && (
            <p role="status">
              Started slots now show your confirmed entry. Unsubmitted
              replacements for those slots were not entered.
            </p>
          )}
          <div
            className={list ? "seven-list" : "fantasy-field seven-field"}

            aria-label="Seven-player lineup"
          >
            {cfg.slots.map((s) => {
              const selected = picks.find((p) => p.slot === s.id),
                card = inventory.find((c) => c.id === selected?.card),
                locked = locks.has(s.id);

              const issue =
                card && !locked ? sevenEligibility(card, data, comp.id) : "";
              return (
                <div className="seven-slot" key={s.id} data-slot={s.id}>
                  <button
                    disabled={!card && (!editable || locked || busy)}
                    className={`field-player ${card ? rarityFrame(card.tier) : ""}`}
                    style={card ? rarityStyle(card.tier) : undefined}
                    onClick={() => {
                      if (card)
                        setProfile({
                          card: card.id,
                          slot: s.id,
                          candidate: false,
                        });
                      else {
                        openSlot(s.id);
                      }
                    }}
                    aria-label={`${s.id}: ${card?.name ?? "Choose owned card"}${card ? ", " + card.tier + ", " + cardIdentity(card) : ""}${locked ? ", locked" : ""}`}
                  >
                    {card ? (
                      <CollectibleFace
                        variant="lineup"
                        showNumber
                        card={card}
                        appliedMultiplier={
                          card.multiplier ??
                          rarityRule(card.tier).multiplierTenths / 10
                        }
                      />
                    ) : (
                      <>
                        <PlayerShirt />
                        <span className="slot-position">
                          {s.id.replace(/[0-9]/g, "")}
                        </span>
                        <strong>Choose player</strong>
                      </>
                    )}
                    <span className="collectible-context">
                      <span>{s.id}</span>
                      {card && mode === "SALARY_CAP" && (
                        <span
                          className="lineup-salary"
                          aria-label="Fantasy salary"
                        >
                          <FantasyAmount value={salary(card.tier, cfg)} />
                        </span>
                      )}
                    </span>
                    {locked && <small className="entry-badge">Locked</small>}
                    {!!issue && (
                      <small className="entry-badge">Needs attention</small>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <aside className="lineup-summary" aria-label="Team summary">
          {" "}
          <div className="seven-budget">
            {mode === "SALARY_CAP" ? (
              <>
                <span className="budget-label">{competitionName(mode)}</span>
                <h2>
                  <FantasyAmount value={check.remaining} />
                </h2>
                <span className="budget-label">Remaining fantasy budget</span>

                <progress
                  value={Math.min(check.total, cfg.salaryCap)}

                  max={cfg.salaryCap}

                  aria-label="Salary cap used"
                />

                <p>
                  Used <FantasyAmount value={check.total} /> /{" "}
                  <FantasyAmount value={cfg.salaryCap} /> ·{" "}
                  {((100 * check.total) / cfg.salaryCap).toFixed(1)}% used
                </p>

                <small>Fantasy salary.</small>
              </>
            ) : (
              <>
                <strong>No salary cap</strong>
              </>
            )}
          </div>
          <p className="selection-count">
            {picks.length}/{cfg.slots.length} selected · {draftState}
          </p>
          {check.errors.length > 0 && (
            <ul role="alert">
              {check.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {entry && (
            <p className="last-saved">
              Last confirmed entry: <LocalDateTime value={entry.updated_at} />
            </p>
          )}
          {saved && (
            <p>
              Last draft save: <LocalDateTime value={saved.updated_at} />
            </p>
          )}
          <div className="seven-actions">
            <button
              hidden={!!entry}
              disabled={busy || !editable || !!check.errors.length}

              onClick={() => void save("seven_draft")}
            >
              Save Draft
            </button>

            <button
              disabled={
                busy ||
                !editable ||
                entryOpensLater ||
                !!full.errors.length ||
                (!!entry && !notSubmitted)
              }

              onClick={() => void save("seven_enter")}
            >
              {entry ? "Update Team" : "Enter Competition"}
            </button>
          </div>
          <p role="status">{notice}</p>
          <details className="team-secondary">
            <summary>Team options & history</summary>
            {entry && !closed && (
              <button
                disabled={busy}

                onClick={() => {
                  if (
                    window.confirm(
                      "Withdraw this entry? Your draft will remain saved.",
                    )
                  )
                    void save("seven_withdraw");
                }}
              >
                Withdraw entry
              </button>
            )}

            {entry && (
              <button
                onClick={() => {
                  if (
                    !draft?.dirty ||
                    window.confirm(
                      "Discard unsaved changes and view your confirmed entry?",
                    )
                  ) {
                    update({
                      picks: entry.snapshot.map((c) => ({
                        slot: c.slot,

                        card: c.card_id,
                      })),

                      revision: saved?.revision ?? 0,

                      entryRevision: entry.revision,

                      dirty: false,
                    });

                    setNotice(
                      "Your confirmed entry is shown. Saving a draft does not change it.",
                    );
                  }
                }}
              >
                View confirmed entry
              </button>
            )}

            <button
              onClick={() => {
                if (
                  !draft?.dirty ||
                  window.confirm(
                    "Discard unsaved changes and reload the latest saved team?",
                  )
                ) {
                  update({
                    picks:
                      saved?.selections ??
                      entry?.snapshot.map((c) => ({
                        slot: c.slot,

                        card: c.card_id,
                      })) ??
                      [],

                    revision: saved?.revision ?? 0,

                    entryRevision: entry?.revision ?? 0,

                    dirty: false,
                  });

                  setNotice(
                    "Loaded the latest saved team. Scores and locks refresh automatically; your unsaved edits stay on this device.",
                  );
                }
              }}
            >
              Reload saved draft
            </button>

            {rounds.filter((c) => c.id !== comp.id).length > 0 && (
              <label>
                Copy previous team to draft
                <select
                  defaultValue=""

                  onChange={(e) => {
                    const prev = data.seven?.entries.find(
                      (x) => x.competition_id === e.target.value,
                    );

                    if (
                      prev &&
                      (!draft?.dirty ||
                        window.confirm(
                          "Replace unsaved draft with this previous team?",
                        ))
                    )
                      update({
                        ...draft!,

                        picks: prev.snapshot.map((c) => ({
                          slot: c.slot,

                          card: c.card_id,
                        })),

                        dirty: true,
                      });

                    e.target.value = "";
                  }}
                >
                  <option value="">Choose previous team…</option>

                  {rounds

                    .filter(
                      (c) =>
                        c.id !== comp.id &&
                        data.seven?.entries.some(
                          (e) => e.competition_id === c.id,
                        ),
                    )

                    .map((c) => (
                      <option value={c.id} key={c.id}>
                        {competitionLabel(c)}
                      </option>
                    ))}
                </select>
                <small>
                  Copied teams require validation and explicit entry.
                </small>
              </label>
            )}
          </details>
          {data.admin && (
            <details className="seven-owner-menu">
              <summary>Owner competition controls</summary>

              <p>
                Rules and scoring snapshots are immutable. Pausing blocks new
                entries and edits; existing locked scoring continues.
              </p>

              <button
                disabled={busy}

                onClick={() => {
                  const reason = window.prompt(
                    "Reason for this audited availability change (12+ characters)",
                  );

                  if (reason && reason.trim().length >= 12)
                    void act("seven_admin_control", {
                      competition_id: comp.id,

                      revision: Number(comp.rules.control_revision ?? 0),

                      enabled: !!comp.rules.disabled,

                      standings_visible: comp.rules.standings_visible !== false,

                      reason,
                    });
                }}
              >
                {comp.rules.disabled
                  ? "Enable entries and editing"
                  : "Pause entries and editing"}
              </button>

              <button
                disabled={busy}

                onClick={() => {
                  const reason = window.prompt(
                    "Reason for this audited standings visibility change (12+ characters)",
                  );

                  if (reason && reason.trim().length >= 12)
                    void act("seven_admin_control", {
                      competition_id: comp.id,

                      revision: Number(comp.rules.control_revision ?? 0),

                      enabled: !comp.rules.disabled,

                      standings_visible: comp.rules.standings_visible === false,

                      reason,
                    });
                }}
              >
                {comp.rules.standings_visible === false
                  ? "Show Rankings"
                  : "Hide Rankings for review"}
              </button>
            </details>
          )}
          <section className="round-summary">
            <h3>This round</h3>
            {entry && <WeeklyLineupResult competition={comp.id} />}
            <p>
              {entryOpensLater
                ? "Draft planning · Entries not open"
                : roundProgress({
                    closesAt: comp.locks_at,
                    finalised: !!comp.scored_at,
                    visible: comp.rules.standings_visible !== false,
                    fixtures,
                    now,
                  }).label}
            </p>
            <small>
              {locks.size} / {entry?.snapshot.length ?? picks.length} selected
              players locked{!comp.scored_at ? " · Totals provisional" : ""}
            </small>
            <Link
              className="play-secondary"
              href={competitionHref("/fantasy/results", {
                ...Object.fromEntries(navigationQuery.entries()),
                sport: "nfl",
                mode,
                competition: comp.id,
                period: navigationQuery.get("period") ?? "weekly",
                season: comp.season,
                week: String(comp.round),
              })}
            >
              View Rankings →
            </Link>
          </section>
          <div className="play-support-actions">
            <Link
              className="play-support"
              href={`/fantasy/scoring/how-it-works?competition=${comp.id}`}
            >
              Scoring rules
            </Link>
            <Link className="play-support" href="/fantasy/cards">
              My Cards
            </Link>
          </div>
          <details>
            <summary>Locks, transfers and scoring</summary>

            <p>
              New entries close at the first fixture. Entered teams can replace
              unstarted players while keeping all seven positions valid. A
              started player stays in their original slot.
            </p>

            <p>
              Before kickoff, replace a submitted card or withdraw before
              entries close to sell it. After kickoff, a transfer preserves your
              locked score; the buyer cannot add that started player. Draft-only
              cards may transfer and will need revalidation.
            </p>

            <p>
              Base NFL points × locked rarity multiplier, including negative
              scores, rounded once to two decimals (half away from zero).
              Corrections use the saved rules. Missing data stays pending. Other
              members cannot inspect your selections.
            </p>
          </details>
        </aside>
      </div>
      {!established && recommendation?.competition === comp.id && (
        <FantasySheet
          title="Review Auto Select"
          onClose={() => setRecommendation(null)}
          historyEntry
        >
          <p>
            Based on up to five verified final appearances before this week,
            using Full-PPR game-log performance and the card multiplier. This is
            a historical ranking, not a forecast or a change to this round’s
            scoring.
          </p>
          <ul>
            {cfg.slots.map((s) => {
              const pick = recommendation.result.picks.find(
                  (p) => p.slot === s.id,
                ),
                card = inventory.find((c) => c.id === pick?.card);
              return (
                <li key={s.id}>
                  <strong>{s.id}</strong>:{" "}
                  {card?.name ?? "Missing eligible card"}
                  {card && recommendation.result.unranked.includes(card.id)
                    ? " · Unranked (no verified history)"
                    : ""}
                  {locks.has(s.id) ? " · Locked, unchanged" : ""}
                </li>
              );
            })}
          </ul>
          {mode === "SALARY_CAP" && (
            <p>
              Salary: <FantasyAmount value={recommendation.result.cost} />
            </p>
          )}
          {!!recommendation.result.missing.length && (
            <p>
              Missing positions: {recommendation.result.missing.join(", ")}. You
              can apply this incomplete draft, but cannot enter until it is
              valid. <Link href="/fantasy/cards">View My Cards</Link>
            </p>
          )}
          {recommendation.asOf && (
            <p>
              History updated: <LocalDateTime value={recommendation.asOf} />
            </p>
          )}
          <p>
            Applying changes your draft only. Save or submit separately after
            reviewing eligibility.
          </p>
          <button
            className="button"
            disabled={
              !editable ||
              busy ||
              !draft ||
              recommendation.original !== normalize(picks)
            }
            onClick={() => {
              if (
                !draft ||
                !editable ||
                recommendation.original !== normalize(picks)
              )
                return;
              const safe = restoreLockedSelections(
                recommendation.result.picks,
                [...locks.values()].map((c) => ({
                  slot: c.slot,
                  card: c.card_id,
                })),
              );
              update({ ...draft, picks: safe, dirty: true });
              setRecommendation(null);
              setNotice(
                "Auto Select applied to this week’s draft. Review and save when ready.",
              );
            }}
          >
            Apply lineup
          </button>
          <button
            className="button secondary"
            onClick={() => setRecommendation(null)}
          >
            Cancel
          </button>
        </FantasySheet>
      )}
      {profile &&
        (() => {
          const card = inventory.find((c) => c.id === profile.card);
          if (!card) return null;
          const locked = locks.has(profile.slot);
          const outgoing = inventory.find(
            (c) => c.id === picks.find((p) => p.slot === profile.slot)?.card,
          );
          const outSalary = outgoing ? salary(outgoing.tier, cfg) : 0;
          const canEdit = editable && !locked && !busy;
          const reason = profile.candidate
            ? !canEdit
              ? "This selection cannot be edited now."
              : candidate(card)
            : !canEdit && !locked
              ? "Editing is closed for this round."
              : sevenEligibility(card, data, comp.id);
          return (
            <FantasyPlayerDetails
              card={card}
              state={data}
              roundId={comp.id}
              onClose={closeProfile}
              lineup={{
                multiplier:
                  card.multiplier ??
                  rarityRule(card.tier).multiplierTenths / 10,
                salary: salary(card.tier, cfg),
                mode,
                now,
                locked,
                reason: locked ? undefined : reason,
                replacement:
                  profile.candidate && mode === "SALARY_CAP"
                    ? {
                        outgoing: outSalary,
                        remaining:
                          check.remaining + outSalary - salary(card.tier, cfg),
                      }
                    : undefined,
                onTransfer:
                  !profile.candidate && canEdit
                    ? () => {
                        openSlot(profile.slot);
                        setProfile(null);
                      }
                    : undefined,
                onRemove:
                  !profile.candidate && canEdit
                    ? () => {
                        update({
                          ...draft!,
                          picks: picks.filter((p) => p.slot !== profile.slot),
                          dirty: true,
                        });
                        setProfile(null);
                      }
                    : undefined,
                onChoose:
                  profile.candidate && canEdit
                    ? () => {
                        if (candidate(card)) return;
                        update({
                          ...draft!,
                          picks: [
                            ...picks.filter((p) => p.slot !== profile.slot),
                            { slot: profile.slot, card: card.id },
                          ],
                          dirty: true,
                        });
                        setProfile(null);
                        close();
                      }
                    : undefined,
              }}
            />
          );
        })()}

      {slot && !profile && (
        <FantasySheet
          title={`Choose ${slot.startsWith("FLEX") ? "FLEX" : slot}`}
          onClose={close}
        >
          <p>
            {slot.startsWith("FLEX")
              ? "Your owned FLEX cards · RB, WR or TE"
              : `Your owned ${slot.replace(/[0-9]/g, "")} cards`}{" "}
            ·{" "}
            {mode === "SALARY_CAP"
              ? `${(check.remaining + (inventory.find((c) => c.id === picks.find((p) => p.slot === slot)?.card) ? salary(inventory.find((c) => c.id === picks.find((p) => p.slot === slot)?.card)!.tier, cfg) : 0)).toLocaleString("en-AU")} available for replacement`
              : "No salary restriction"}
          </p>

          <label>
            Search players
            <input
              value={search}

              onChange={(e) => setSearch(e.target.value)}

              type="search"
            />
          </label>

          <div className="seven-filters">
            <label>
              Team
              <select value={team} onChange={(e) => setTeam(e.target.value)}>
                <option value="">All teams</option>

                {teams.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Rarity
              <select value={tier} onChange={(e) => setTier(e.target.value)}>
                <option value="">All rarities</option>

                {rarities.map((t) => (
                  <option key={t} value={t}>
                    {rarityRule(t).label}
                  </option>
                ))}
              </select>
            </label>

            {slot.startsWith("FLEX") && (
              <label>
                Position
                <select
                  aria-label="Position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                >
                  <option value="">All · RB / WR / TE</option>
                  {["RB", "WR", "TE"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            )}

            <label>
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="name">Player name</option>

                <option value="rarity">Rarity / multiplier</option>

                {mode === "SALARY_CAP" && (
                  <option value="salary">Salary, lowest first</option>
                )}
              </select>
            </label>
          </div>

          <div className="picker-results" role="status">
            {filtered.length} matching cards
            {(search || team || tier || position) && (
              <button
                className="play-support"
                onClick={() => {
                  setSearch("");
                  setTeam("");
                  setTier("");
                  setPosition("");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
          {!pool.length ? (
            <p>No owned cards for this position in this competition.</p>
          ) : !filtered.length ? (
            <p>No cards match your current filters.</p>
          ) : filtered.every((c) => candidate(c)) ? (
            <p>
              Matching cards exist, but none are currently selectable. See the
              reasons below.
            </p>
          ) : null}
          {filtered.slice((page - 1) * 20, page * 20).map((c) => {
            const reason = candidate(c);
            return (
              <button
                className={`seven-candidate compact-candidate ${rarityFrame(c.tier)}`}
                style={rarityStyle(c.tier)}
                key={c.id}
                disabled={!!reason}
                onClick={() =>
                  setProfile({ card: c.id, slot, candidate: true })
                }
              >
                <span className="candidate-collectible">
                  <CollectibleFace
                    variant="lineup"
                    showNumber
                    card={c}
                    appliedMultiplier={
                      c.multiplier ?? rarityRule(c.tier).multiplierTenths / 10
                    }
                  />
                </span>
                <span className="candidate-context">
                  {mode === "SALARY_CAP" && (
                    <small className="block-note">
                      Fantasy salary{" "}
                      {salary(c.tier, cfg).toLocaleString("en-AU")}
                    </small>
                  )}
                  {reason && (
                    <small className="block-note candidate-reason">
                      {reason}
                    </small>
                  )}
                </span>
                <span aria-hidden="true">›</span>
              </button>
            );
          })}

          {filtered.length > 20 && (
            <nav
              aria-label="Player results pages"
              className="play-support-actions"
            >
              <button
                disabled={page === 1}
                onClick={() => setPickerPage(page - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of {Math.ceil(filtered.length / 20)}
              </span>
              <button
                disabled={page * 20 >= filtered.length}
                onClick={() => setPickerPage(page + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </FantasySheet>
      )}
    </section>
  );
}
