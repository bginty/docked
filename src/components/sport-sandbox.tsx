"use client";
import { useEffect, useRef, useState } from "react";
import { SevenField } from "./seven-field";
import { CollectibleFace } from "./collectible-face";
import { FantasySheet } from "./fantasy-sheet";
import { fitsSlot, sevenIssues, type SlotSelection } from "@/core/nfl-seven";
import {
  sportConfigurations,
  sportActivationBlockers,
} from "@/core/sport-configuration";
import type { SandboxState, SandboxCard } from "@/core/sport-sandbox";
import { sandboxSelections } from "@/core/sport-lineup-view";
import { boundedFetch } from "@/core/bounded-request";
import type { autoSelect } from "@/core/lineup-auto-select";

export function SportSandbox({ initial }: { initial: SandboxState }) {
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
  const sport = sportConfigurations[state.sport];
  const rounds = state.competitions
    .filter((c) => c.rules.mode === mode)
    .sort((a, b) => a.round - b.round);
  const comp = rounds.find((c) => c.id === round) ?? rounds[0];
  const cfg = state.configurations[comp?.rules.lineup_version];
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
      const r = await boundedFetch("/api/admin/sports-sandbox", {
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
      const r = await boundedFetch(
        `/api/admin/sports-sandbox?sport=${state.sport}`,
        { cache: "no-store" },
      );
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
      </>
    );
  }
  return (
    <section className="sport-sandbox">
      <h1>{sport?.label ?? state.sport} · Team laboratory</h1>
      <nav aria-label="Sandbox sport">
        {Object.values(sportConfigurations)
          .filter((c) => !c.publicEnabled)
          .map((c) => (
            <a
              key={c.id}
              href={`/admin/sports?sport=${c.id}`}
              aria-current={state.sport === c.id ? "page" : undefined}
              onClick={(e) => {
                if (
                  busy ||
                  (dirty && !window.confirm("Discard unsaved lineup changes?"))
                )
                  e.preventDefault();
              }}
            >
              {c.label}
              {c.formatStatus === "proposal" ? " · Proposed" : ""}
            </a>
          ))}
      </nav>
      <p className="sport-sandbox-notice">
        Isolated sandbox · Fictional QA cards · No member assets, credits or
        prizes. Salary units are test fixtures; scoring and live issuance are
        disabled.
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
            <option value="SALARY_CAP">Traditional · QA salary units</option>
            <option value="OPEN">All-Star</option>
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
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setList(!list)}>
          {list ? "Field view" : "List view"}
        </button>
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
              ? ` · ${validate?.total ?? 0}/${cfg.salaryCap} QA salary units`
              : ""}
          </p>
          {!readOnly && (
            <div className="sport-sandbox-controls">
              {!established && (
                <button
                  disabled={busy}
                  onClick={() => void command("auto_select")}
                >
                  Auto Select
                </button>
              )}
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
            {proposal.picks.length} positions filled. No verified performance
            feed is connected; unranked cards use deterministic eligibility and
            salary ordering.
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
      {sport && (
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
