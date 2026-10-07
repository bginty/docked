"use client";
import { useState, type FormEvent } from "react";
type Catalog = {
  players: { id: string; name: string }[];
  editions: {
    id: string;
    tier: string;
    player_id: string;
    max_supply: number;
    status: string;
  }[];
  replacements: { card_id: string; user_id: string; pack_id: string | null }[];
  sales: unknown[];
  ownership: unknown[];
};
export function FantasyAdmin({
  catalog,
  act,
  busy,
}: {
  catalog: Catalog | null;
  act: (a: string, p: Record<string, unknown>) => Promise<unknown>;
  busy: boolean;
}) {
  const [problem, setProblem] = useState("");
  const now = new Date();
  const date = now.toISOString();
  function submit(e: FormEvent<HTMLFormElement>, action: string) {
    e.preventDefault();
    try {
      const f = new FormData(e.currentTarget);
      const payload = JSON.parse(String(f.get("payload")));
      setProblem("");
      void act(action, payload);
    } catch {
      setProblem("Enter valid JSON before submitting.");
    }
  }
  const configs = [
    {
      action: "admin_competition",
      title: "Configure competition eligibility",
      value: {
        name: "Custom Preview League",
        season: "2027",
        round: 1,
        locks_at: new Date(now.getTime() + 3600000).toISOString(),
        scoring_version: "football-demo-v1",
        rules: {
          positions: { GK: 1, DEF: 4, MID: 4, FWD: 2 },
          duplicates: false,
          tier_max: { ELITE: 1, LEGENDARY: 0, ICON: 0 },
          core_min: 5,
          first_year_min: 3,
        },
      },
    },
    {
      action: "admin_stats",
      title: "Input fictional round statistics",
      value: {
        competition_id: "",
        player_id: catalog?.players[0]?.id ?? "",
        stats: {
          minutes: 90,
          goals: 0,
          assists: 0,
          conceded: 0,
          saves: 0,
          yellow: 0,
          red: 0,
          own_goals: 0,
        },
      },
    },
    {
      action: "admin_scoring",
      title: "Create scoring rule version",
      value: {
        version: "football-demo-v2",
        rules: {
          appearance: 1,
          sixty_minutes: 1,
          goal: { GK: 6, DEF: 6, MID: 5, FWD: 4 },
          assist: 3,
          clean_sheet: { GK: 4, DEF: 4, MID: 1, FWD: 0 },
          save_group: 3,
          save_points: 1,
          yellow: -1,
          red: -3,
          own_goal: -2,
          conceded_group: 2,
          conceded_points: -1,
        },
      },
    },
    {
      action: "admin_player",
      title: "Create fictional player",
      value: {
        name: "Aiden Cove",
        sport: "football",
        position: "MID",
        team: "Harbour Blue",
        colour: "#1A2AFF",
        shirt: 37,
        first_season: "2027",
        prospect_rank: 37,
      },
    },
    {
      action: "admin_edition",
      title: "Declare a card edition",
      value: {
        player_id: catalog?.players[0]?.id ?? "",
        tier: "CORE",
        season: "2028",
        kind: "regular",
        max_supply: 100,
        prospect_rank: 1,
        launch_at: date,
      },
    },
    {
      action: "admin_pack",
      title: "Create a versioned pack",
      value: {
        name: "Scout Pack",
        version: 1,
        slots: ["ANY", "ANY", "ANY"],
        pool: (catalog?.editions ?? [])
          .filter((e) => e.tier === "CORE")
          .slice(0, 10)
          .map((e) => e.id),
        weights: { CORE: 100 },
        guarantees: {},
        price: 50,
        max_quantity: 10,
        tradeable: true,
        starts_at: date,
        ends_at: new Date(now.getTime() + 86400000 * 30).toISOString(),
      },
    },
    {
      action: "admin_fee",
      title: "Configure future listing fee",
      value: { fee_bps: 750 },
    },
  ];
  return (
    <>
      <p role="alert">{problem}</p>
      {configs.map((c) => (
        <section className="fantasy-panel" key={c.action}>
          <h2>{c.title}</h2>
          <p>
            Validated configuration. Existing supply, pack versions and
            completed transactions stay immutable.
          </p>
          <form onSubmit={(e) => submit(e, c.action)}>
            <label>
              Configuration JSON
              <textarea
                name="payload"
                rows={Math.min(
                  18,
                  JSON.stringify(c.value, null, 2).split("\n").length,
                )}
                defaultValue={JSON.stringify(c.value, null, 2)}
                required
                spellCheck={false}
              />
            </label>
            <button disabled={busy}>Save configuration</button>
          </form>
        </section>
      ))}
      <section className="fantasy-panel">
        <h2>Launch declared editions</h2>
        <p>
          Supply can never be increased. Launching locks edition identity and
          supply.
        </p>
        {catalog?.editions
          .filter((e) => e.status === "draft")
          .map((e) => (
            <div className="fantasy-row" key={e.id}>
              <span>
                {catalog.players.find((p) => p.id === e.player_id)?.name} ·{" "}
                {e.tier} · {e.max_supply}
              </span>
              <button
                disabled={busy}
                onClick={() => act("admin_lock_edition", { edition_id: e.id })}
              >
                Lock & launch
              </button>
            </div>
          ))}
      </section>
      <section className="fantasy-panel">
        <h2>Replacement queue</h2>
        {catalog?.replacements
          ?.filter((r) => !r.pack_id)
          .map((r) => (
            <div className="fantasy-row" key={r.card_id}>
              <code>{r.card_id}</code>
              <button
                disabled={busy}
                onClick={() => act("admin_replacement", { card_id: r.card_id })}
              >
                Issue replacement
              </button>
            </div>
          ))}
      </section>
      <section className="fantasy-panel">
        <h2>Audit records</h2>
        <details>
          <summary>Players and editions</summary>
          <pre>
            {JSON.stringify(
              { players: catalog?.players, editions: catalog?.editions },
              null,
              2,
            )}
          </pre>
        </details>
        <details>
          <summary>Marketplace settlement</summary>
          <pre>{JSON.stringify(catalog?.sales ?? [], null, 2)}</pre>
        </details>
        <details>
          <summary>Ownership ledger</summary>
          <pre>{JSON.stringify(catalog?.ownership ?? [], null, 2)}</pre>
        </details>
      </section>
    </>
  );
}
