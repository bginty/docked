"use client";

import Link from "next/link";

import {
  availability,
  cardIdentity,
  sevenEligibility,
  sevenPositions,
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

import { FantasySheet, PlayerShirt } from "./fantasy-player-sheet";

import { LocalDateTime } from "./local-date-time";

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
    rounds.find((c) => Date.parse(c.locks_at) > now) ??
    rounds.at(-1);

  const cfg =
    data.seven?.configurations[String(comp?.rules.lineup_version)] ?? nflSeven;

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
      old[comp.id]
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
  }, [comp, saved, entry]);

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

  const fixtures = data.seven?.fixtures[comp?.id ?? ""] ?? [];

  const kickoff = (c: FantasyCard) =>
    fixtures.find((f) =>
      f.playerIds.includes(c.canonical_player_id ?? c.player_id),
    );

  const locks = new Map(
    (entry?.snapshot ?? [])

      .filter(
        (c) =>
          Date.parse(c.kickoff) <= now ||
          data.seven?.locks.some(
            (l) => l.competition_id === comp?.id && l.slot === c.slot,
          ),
      )

      .map((c) => [c.slot, c]),
  );

  const inventory = [...(data.seven?.inventory ?? [])];

  const picks = restoreLockedSelections(
    draftPicks,

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
      !!comp && !comp.scored_at && (!closed || !!entry) && !comp.rules.disabled;

  const nextLock = entry?.snapshot

    .map((c) => c.kickoff)

    .filter((t) => Date.parse(t) > now)

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
        <h2>{mode === "OPEN" ? "Open" : "Salary Cap"}</h2>

        <p>No verified upcoming round is available yet.</p>
      </section>
    );

  return (
    <section className="fantasy-play seven-play">
      {data.admin && (
        <details className="fantasy-panel">
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
              ? "Show standings"
              : "Hide standings for review"}
          </button>
        </details>
      )}

      <header className="play-heading">
        <div>
          <p className="eyebrow">NFL · ISOLATED TEST COMPETITION</p>

          <h1>{mode === "OPEN" ? "Open" : "Salary Cap"}</h1>

          <p>
            {data.team_name ?? "Your team"} ·{" "}
            {entry ? "Entered" : "Not entered"}
            {draft?.dirty ? " · Unsaved changes" : ""}
          </p>
        </div>
      </header>

      <label>
        Season / week
        <select
          value={comp.id}

          onChange={(e) => {
            setChosen(e.target.value);

            setNotice("");
          }}
        >
          {rounds.map((c) => (
            <option key={c.id} value={c.id}>
              {c.season} · Week {c.round} · {c.name}
            </option>
          ))}
        </select>
      </label>

      <p>
        Free test competition · no cash value or prizes. Post-game scores await
        verified results.
      </p>

      <div className="fantasy-panel">
        <strong>
          {closed ? "New entries closed" : "Enter before"}{" "}
          <LocalDateTime value={comp.locks_at} />
        </strong>

        <p>
          {nextLock ? (
            <>
              Next player lock: <LocalDateTime value={nextLock} />
            </>
          ) : (
            "Each submitted player locks at their own kickoff."
          )}
        </p>

        {mode === "SALARY_CAP" ? (
          <>
            <h2>
              {check.total.toLocaleString("en-AU")} /{" "}
              {cfg.salaryCap.toLocaleString("en-AU")}
            </h2>

            <progress
              value={Math.min(check.total, cfg.salaryCap)}

              max={cfg.salaryCap}

              aria-label="Salary cap used"
            />

            <p>
              {check.remaining.toLocaleString("en-AU")} remaining ·{" "}
              {((100 * check.total) / cfg.salaryCap).toFixed(1)}% used
            </p>

            <small>
              Fantasy salary dollars, never a charge to Docked Credits. Elite
              salary is a test setting.
            </small>
          </>
        ) : (
          <>
            <h2>No Salary Cap</h2>

            <p>All six rarities · 1.0× to 1.5× scoring</p>
          </>
        )}
      </div>

      <div className="field-toolbar">
        <h2>Pick your seven</h2>

        <button onClick={() => setList(!list)} aria-pressed={list}>
          {list ? "Field view" : "List view"}
        </button>
      </div>

      {restoredLocks && (
        <p role="status">
          Started slots now show your confirmed entry. Unsubmitted replacements
          for those slots were not entered.
        </p>
      )}

      <div
        className={list ? "seven-list" : "fantasy-field seven-field"}

        aria-label="Seven-player lineup"
      >
        {cfg.slots.map((s) => {
          const selected = picks.find((p) => p.slot === s.id),
            card = inventory.find((c) => c.id === selected?.card),
            locked = locks.has(s.id),
            f = card && kickoff(card);

          return (
            <div className="seven-slot" key={s.id}>
              <button
                disabled={!editable || locked || busy}

                className="field-player"

                onClick={() => {
                  setSlot(s.id);

                  setSearch("");
                }}

                aria-label={`${s.id}: ${card?.name ?? "Choose owned card"}${card ? `, ${card.tier}, ${cardIdentity(card)}` : ""}${locked ? ", locked" : ""}`}
              >
                {!list && <PlayerShirt card={card} />}

                <strong>{s.id.replace("1", "")}</strong>

                <span className="field-player-name">
                  {card?.name ?? "Choose card"}
                </span>

                {card && (
                  <>
                    <small>
                      {card.team} · {card.position}
                    </small>

                    <small>
                      {rarityRule(card.tier).label} ·{" "}
                      {card.multiplier ??
                        rarityRule(card.tier).multiplierTenths / 10}
                      ×
                    </small>

                    <small>
                      {card.tier === "CORE"
                        ? `Core instance ${card.id.slice(-8)} · unlimited`
                        : `#${card.serial} / ${card.max_supply}`}
                    </small>

                    {mode === "SALARY_CAP" && (
                      <small>
                        {salary(card.tier, cfg).toLocaleString("en-AU")}
                      </small>
                    )}
                  </>
                )}
              </button>

              <small>
                {locked ? (
                  "Locked"
                ) : f ? (
                  <LocalDateTime value={f.scheduledAt} />
                ) : (
                  s.positions.join(" / ")
                )}
              </small>

              {card && !locked && editable && (
                <button
                  className="button-secondary"

                  disabled={busy}

                  onClick={() =>
                    update({
                      ...draft!,

                      picks: picks.filter((p) => p.slot !== s.id),

                      dirty: true,
                    })
                  }

                  aria-label={`Remove ${card.name}`}
                >
                  Remove
                </button>
              )}

              {card && (
                <small>
                  {(() => {
                    const score = data.round_details

                      ?.find((r) => r.competition_id === comp.id)

                      ?.scores.find(
                        (p) =>
                          p.player_id ===
                          (card.canonical_player_id ?? card.player_id),
                      );

                    return score &&
                      score.score !== null &&
                      score.score !== undefined
                      ? `${score.base_score ?? score.score} × ${score.multiplier ?? 1} = ${score.score} points · ${comp.scored_at ? "Final" : "Provisional"}`
                      : f && Date.parse(f.scheduledAt) > now
                        ? "Awaiting game"
                        : "Awaiting data";
                  })()}
                </small>
              )}
            </div>
          );
        })}
      </div>

      <p>
        {picks.length}/{cfg.slots.length} occupied · {draftState}. QB · 2 RB · 2
        WR · TE · FLEX (RB/WR/TE). Kickers and defence cards are not eligible.
      </p>

      {check.errors.length > 0 && (
        <ul role="alert">
          {check.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {entry && (
        <p>
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
          disabled={busy || !editable || !!check.errors.length}

          onClick={() => void save("seven_draft")}
        >
          Save Draft
        </button>

        <button
          disabled={busy || !editable || !!full.errors.length}

          onClick={() => void save("seven_enter")}
        >
          {entry ? "Update Entered Team" : "Enter Competition"}
        </button>

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
      </div>

      <p role="status">{notice}</p>

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
              "Loaded latest server state. Use Refresh team & points below to check for changes from another device.",
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
                  data.seven?.entries.some((e) => e.competition_id === c.id),
              )

              .map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <small>Copied teams require validation and explicit entry.</small>
        </label>
      )}

      <p>
        <Link href={`/fantasy/scoring/how-it-works?competition=${comp.id}`}>Scoring rules</Link>{" · "}
        <Link href={`/fantasy/results?competition=${comp.id}`}>Player points & weekly standings →</Link>{" "}
        · <Link href="/fantasy/cards">My cards →</Link>
      </p>

      <details>
        <summary>Locks, transfers and scoring</summary>

        <p>
          New entries close at the first fixture. Entered teams can replace
          unstarted players while keeping all seven positions valid. A started
          player stays in their original slot.
        </p>

        <p>
          Before kickoff, replace a submitted card or withdraw before entries
          close to sell or swap it. After kickoff, a transfer preserves your
          locked score; the buyer cannot add that started player. Draft-only
          cards may transfer and will need revalidation.
        </p>

        <p>
          Base NFL points × locked rarity multiplier, including negative scores,
          rounded once to two decimals (half away from zero). Corrections use
          the saved rules. Missing data stays pending. Other members cannot
          inspect your selections.
        </p>
      </details>

      {slot && (
        <FantasySheet title={`Choose ${slot}`} onClose={close}>
          <p>
            Owned cards only ·{" "}
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

                {[...new Set(inventory.map((c) => c.team))].sort().map((t) => (
                  <option key={t}>{t}</option>
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

            <label>
              Position
              <select
                value={position}

                onChange={(e) => setPosition(e.target.value)}
              >
                <option value="">All positions</option>

                {sevenPositions.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>

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

          {inventory

            .filter(
              (c) =>
                (!team || c.team === team) &&
                (!tier || c.tier === tier) &&
                (!position || c.position === position) &&
                c.name.toLowerCase().includes(search.toLowerCase()),
            )

            .sort((a, b) =>
              sort === "salary"
                ? salary(a.tier, cfg) - salary(b.tier, cfg)
                : sort === "rarity"
                  ? rarityRule(b.tier).multiplierTenths -
                    rarityRule(a.tier).multiplierTenths
                  : a.name.localeCompare(b.name),
            )

            .map((c) => {
              const reason = candidate(c),
                fixture = kickoff(c),
                outgoing = inventory.find(
                  (x) => x.id === picks.find((p) => p.slot === slot)?.card,
                ),
                outSalary = outgoing ? salary(outgoing.tier, cfg) : 0,
                incoming = salary(c.tier, cfg);

              return (
                <button
                  className="seven-candidate"

                  key={c.id}

                  disabled={!!reason || busy}

                  onClick={() => {
                    update({
                      ...draft!,

                      picks: [
                        ...picks.filter((p) => p.slot !== slot),

                        { slot, card: c.id },
                      ],

                      dirty: true,
                    });

                    close();
                  }}
                >
                  <PlayerShirt card={c} />

                  <span>
                    <strong>{c.name}</strong>
                    <br />
                    {c.team} · {c.position} · {rarityRule(c.tier).label} ·{" "}
                    {rarityRule(c.tier).multiplierTenths / 10}×<br />
                    {cardIdentity(c)}
                    {mode === "SALARY_CAP"
                      ? ` · ${salary(c.tier, cfg).toLocaleString("en-AU")}`
                      : ""}
                    <br />
                    <small>
                      {fixture ? (
                        <>
                          Kickoff <LocalDateTime value={fixture.scheduledAt} />
                        </>
                      ) : (
                        "No mapped fixture · bye unconfirmed"
                      )}
                      . Opponent unavailable. Injury report unavailable. Roster:{" "}
                      {c.source_status ?? c.status}.
                    </small>
                    {mode === "SALARY_CAP" && (
                      <small>
                        <br />
                        Outgoing {outSalary.toLocaleString()} · Incoming{" "}
                        {incoming.toLocaleString()} · Change{" "}
                        {(incoming - outSalary).toLocaleString()} · Remaining{" "}
                        {(
                          check.remaining +
                          outSalary -
                          incoming
                        ).toLocaleString()}
                      </small>
                    )}
                    <small>
                      <br />
                      Recent base points: awaiting verified history.
                      Rarity-adjusted points depend on the locked round.
                    </small>
                    {reason && (
                      <>
                        <br />

                        <small>{reason}</small>
                      </>
                    )}
                  </span>
                </button>
              );
            })}

          {!inventory.length && (
            <p>
              No eligible owned cards yet. Open your free starter pack in My
              Cards. We never buy cards automatically.
            </p>
          )}
        </FantasySheet>
      )}
    </section>
  );
}
