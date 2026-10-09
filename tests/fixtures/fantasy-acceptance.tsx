import { createRoot } from "react-dom/client";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { FantasyScreen } from "../../src/components/fantasy-screen";
import { AppShell } from "../../src/components/app-shell";
import type { FantasyState } from "../../src/core/fantasy";

// Authored design fixture only. No session, live player, purchase or ownership claim.
const id = (n: number) =>
  "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
export const state: FantasyState = {
  user_id: id(1),
  credits: 250,
  admin: false,
  fee_bps: 250,
  catalog: null,
  cards: [
    "GK",
    "DEF",
    "DEF",
    "DEF",
    "DEF",
    "MID",
    "MID",
    "MID",
    "MID",
    "FWD",
    "FWD",
  ].map((position, n) => ({
    id: id(10 + n),
    edition_id: id(30 + n),
    owner_id: id(1),
    serial: n + 1,
    tradeable: n > 0,
    created_at: "2026-10-01T00:00:00Z",
    acquired_at: "2026-10-01T00:00:00Z",
    name:
      n === 0
        ? "Fictional Alexander Northbridge-Wellington"
        : "Fictional Player " + (n + 1),
    position,
    tier: n === 1 ? "RARE" : "CORE",
    season: "2026",
    kind: "season",
    max_supply: 100,
    player_id: id(50 + n),
    team: "Fictional North Harbour",
    colour: "#1A2AFF",
    shirt: n + 1,
    status: "active",
    sport: "football",
    listed: false,
  })),
  packs: [
    {
      id: id(100),
      name: "Authored Starter fixture",
      opened_at: "2026-10-01T00:00:00Z",
      cards: [id(10), id(11)],
    },
  ],
  shop: [],
  market: [],
  trades: [],
  competitions: [
    {
      id: id(101),
      name: "Fixture Football League",
      season: "2026",
      round: 1,
      locks_at: "2099-10-12T00:00:00Z",
      scored_at: null,
      rules: {
        positions: { GK: 1, DEF: 4, MID: 4, FWD: 2 },
        tiers: ["CORE", "RARE", "ELITE", "LEGENDARY", "ICON"],
      },
    },
  ],
  entries: [],
  results: [],
  ledger: [],
  provenance: [
    {
      id: id(201),
      card_id: id(10),
      from_user: null,
      to_user: id(1),
      reason: "starter",
      created_at: "2026-10-01T00:00:00Z",
    },
  ],
  members: [{ id: id(1), name: "Fixture member" }],
  replacements: [],
};
const root = createRoot(document.getElementById("fixture-root")!);
let current = "play";
function render(tab: string, empty = false) {
  current = tab;
  Object.assign(window, { demoPath: "/fantasy/" + tab });
  history.replaceState(null, "", "/fantasy/" + tab);
  root.render(
    <AppRouterContext.Provider
      value={{
        back() {},
        forward() {},
        refresh() {},
        push(url) {
          render(url.split("/")[2] ?? "play");
        },
        replace(url) {
          render(url.split("/")[2] ?? "play");
        },
        prefetch: async () => {},
        hmrRefresh() {},
      }}
    >
      <PathnameContext.Provider value={"/fantasy/" + tab}>
        <p className="fixture-disclosure">
          DESIGN FIXTURE · fictional data · not hosted gameplay
        </p>
        <AppShell authenticated>
          <FantasyScreen
            key={tab + empty}
            tab={tab}
            initial={
              empty
                ? {
                    ...state,
                    cards: [],
                    packs: [],
                    competitions: [],
                    members: [],
                    provenance: [],
                  }
                : state
            }
          />
        </AppShell>
      </PathnameContext.Provider>
    </AppRouterContext.Provider>,
  );
}
Object.assign(window, {
  renderFantasy: render,
  fantasyFixtureState: state,
  currentFantasyTab: () => current,
});

document.addEventListener("click", (event) => {
  const link = (event.target as HTMLElement).closest("a");
  if (link?.pathname.startsWith("/fantasy/")) {
    event.preventDefault();
    render(link.pathname.split("/")[2]);
  }
});
