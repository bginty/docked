// Local visual fixtures only. No application authentication, provider or database.
import { CompetitionResults } from "../../src/components/competition-results";
import { standingsFixture } from "./standings-data";
import { RarityGallery } from "./rarity-gallery";
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { AppShell } from "../../src/components/app-shell";
import { EnvironmentProvider } from "../../src/components/environment-context";
import { FantasyScreen } from "../../src/components/fantasy-screen";
import { SocialComposer } from "../../src/components/social-composer";
import { Marketplace } from "../../src/components/marketplace";
import { MemberTestWallet } from "../../src/components/member-test-wallet";
import PackOpening from "../../src/components/pack-opening";
import { FantasyCardArtwork } from "../../src/components/fantasy-card-artwork";
import { FantasySheet } from "../../src/components/fantasy-player-sheet";
import type { FantasyState } from "../../src/core/fantasy";
import { nflSeven, sevenIssues, salary } from "../../src/core/nfl-seven";
import { rarityRule } from "../../src/core/card-rarity";
const now = new Date().toISOString(),
  future = new Date(Date.now() + 86400000 * 7).toISOString();
const tiers = [
  "CORE",
  "RARE",
  "RARE",
  "ELITE",
  "ELITE",
  "RARE",
  "CORE",
  "RARE",
  "RARE",
];
const cards: FantasyState["cards"] = tiers.map((tier, i) => ({
  id: `visual-card-${i}`,
  edition_id: `visual-edition-${i}`,
  owner_id: "visual-member",
  player_id: `visual-player-${i}`,
  serial: i + 1,
  max_supply: rarityRule(tier).lifetimeCap ?? 0,
  tier,
  name: [
    "Alex Northbridge-Wellington",
    "Jordan Field",
    "Cameron Reed",
    "Casey Rivers",
    "Morgan Lane",
    "Taylor West",
    "Sam Carter",
    "Blake Hill",
    "Jamie Brooks",
  ][i],
  sport: "nfl",
  team: ["NYG", "KC", "CHI", "SEA", "BAL", "PIT", "GB", "UNKNOWN", "BUF"][i],
  position: ["QB", "RB", "RB", "WR", "WR", "TE", "RB", "WR", "K"][i],
  colour: "#1677FF",
  shirt: 1,
  // Synthetic verified-number metadata for visual acceptance; never production player facts.
  verifiedJerseyNumber: [8, 31, 28, 17, 13, 84, 87, null, 0][i],
  status: "active",
  tradeable: tier !== "CORE",
  listed: false,
  season: "2026",
  kind: "season",
  created_at: now,
  acquired_at: now,
}));
const rounds = ["SALARY_CAP", "OPEN"].map((mode, i) => ({
  id: `visual-round-${i}`,
  name: `Local preview · ${mode}`,
  season: "2026",
  round: 7,
  sport: "nfl",
  locks_at: future,
  scored_at: null,
  rules: { mode, lineup_version: nflSeven.version },
}));
let state: FantasyState = {
  team_name: "Local Test Team",
  user_id: "visual-member",
  mode: "production",
  nfl_beta: true,
  credits: 0,
  admin: false,
  fee_bps: 750,
  catalog: null,
  cards,
  packs: [],
  shop: [],
  market: [],
  trades: [],
  competitions: rounds,
  entries: [],
  results: [],
  ledger: [],
  provenance: [],
  members: [{ id: "visual-member", name: "Local member" }],
  replacements: [],
  seven: {
    inventory: cards,
    configurations: { [nflSeven.version]: nflSeven },
    drafts: rounds.map((c) => ({
      competition_id: c.id,
      revision: 1,
      selections: nflSeven.slots.map((s, i) => ({
        slot: s.id,
        card: cards[i].id,
      })),
      updated_at: now,
    })),
    entries: [],
    locks: [],
    fixtures: Object.fromEntries(
      rounds.map((c) => [
        c.id,
        [
          {
            fixtureId: "visual-game",
            scheduledAt: future,
            playerIds: cards.map((c) => c.player_id),
            status: "scheduled",
          },
        ],
      ]),
    ),
    server_time: now,
  },
  starter_receipt: {
    id: "visual-starter",
    name: "Starter",
    opened_at: now,
    cards,
  },
  rewards: {
    server_time: now,
    period_timezone: "UTC",
    next_claim_at: future,
    claimed_today: true,
    starter_claimed: true,
    daily_available: false,
    points: 0,
    policy: { version: 1, daily_points: 0, card_every: 7, daily_card_limit: 0 },
    history: [],
  },
};

// Browser-only synthetic persistence for visual Save Draft / Enter states.
// Never bundled by an application route and never forwards fantasy writes.
const fixtureKey = "docked:play-standings-fixture:v1";
try {
  const saved = sessionStorage.getItem(fixtureKey);
  if (saved) {
    const value = JSON.parse(saved);
    if (value.user_id === "visual-member") state = value;
  }
} catch {}
// Explicit local-only visual states. No server, account or catalogue mutation.
const scenario = new URLSearchParams(location.search).get("scenario");
if (scenario === "picker-cases") {
  const extra = Array.from({ length: 24 }, (_, i) => ({
    ...cards[0],
    id: `extra-qb-${i}`,
    player_id: `extra-qb-${i}`,
    name: `Quarterback ${i}`,
    team: i % 2 ? "NYJ" : "NYG",
    tier: i % 2 ? "RARE" : "CORE",
    listed: i === 23,
  }));
  state.cards.push(...extra);
  state.seven!.inventory = [...state.cards];
  for (const fixtures of Object.values(state.seven!.fixtures))
    fixtures[0].playerIds.push(...extra.map((c) => c.player_id));
}
if (scenario === "empty") {
  state.cards = [];
  state.seven!.inventory = [];
  state.seven!.drafts.forEach((d) => (d.selections = []));
}
if (scenario === "incomplete")
  state.seven!.drafts.forEach((d) => (d.selections = d.selections.slice(0, 4)));
if (scenario === "invalid")
  state.seven!.inventory = state.seven!.inventory.filter(
    (c) => c.id !== cards[0].id,
  );
if (scenario === "all-rarities") {
  const all = ["CORE", "RARE", "ELITE", "ULTRA_RARE", "LEGENDARY", "ICON"];
  state.cards = Array.from({ length: 23 }, (_, i) => ({
    ...cards[i % cards.length],
    id: "gallery-card-" + i,
    tier: all[i % 6],
    serial: i % 6 === 5 ? 1 : i + 1,
    max_supply: rarityRule(all[i % 6]).lifetimeCap ?? 0,
  }));
}
if (["entered", "partial"].includes(scenario ?? "")) {
  state.seven!.entries = rounds.map((round) => ({
    competition_id: round.id,
    revision: 1,
    updated_at: now,
    snapshot: nflSeven.slots.map((slot, i) => ({
      ...cards[i],
      slot: slot.id,
      card_id: cards[i].id,
      kickoff:
        scenario === "partial" && i === 0
          ? new Date(Date.now() - 60000).toISOString()
          : future,
      salary: salary(cards[i].tier),
      multiplier: rarityRule(cards[i].tier).multiplierTenths / 10,
    })),
  }));
}
if (scenario === "packs")
  state.packs = [
    {
      id: "local-free-1",
      name: "Local free pack",
      opened_at: null,
      cards: null,
    },
  ];
const fetchOriginal = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
    location.origin,
  );
  if (
    url.origin === location.origin &&
    url.pathname === "/api/test-wallet" &&
    ["/fantasy/play", "/fantasy/cards"].includes(location.pathname) &&
    (!init?.method || init.method === "GET")
  ) {
    return Response.json({
      state: {
        member: state.user_id,
        wallet: { spendable: 12500 },
        packs:
          scenario === "packs"
            ? [{ status: "SEALED" }, { status: "SEALED" }]
            : [],
      },
    });
  }
  if (url.origin !== location.origin || url.pathname !== "/api/fantasy")
    return fetchOriginal(input, init);
  try {
    const req = init?.method === "POST" ? JSON.parse(String(init.body)) : null;
    if (req) {
      const c = state.competitions.find(
        (c) => c.id === req.payload.competition_id,
      );
      if (!c || !state.seven) throw Error("Local fixture round unavailable");
      const picks = req.payload.selections ?? [];
      if (req.action === "seven_draft" || req.action === "seven_enter") {
        const errors = sevenIssues(
          c.rules.mode as "OPEN" | "SALARY_CAP",
          picks,
          state.cards,
          req.action === "seven_enter",
        ).errors;
        if (errors.length) throw Error(errors.join(" "));
        if (req.action === "seven_draft") {
          const old = state.seven.drafts.find((d) => d.competition_id === c.id);
          state.seven.drafts = state.seven.drafts.filter(
            (d) => d.competition_id !== c.id,
          );
          state.seven.drafts.push({
            competition_id: c.id,
            revision: (old?.revision ?? 0) + 1,
            selections: picks,
            updated_at: new Date().toISOString(),
          });
        } else {
          const old = state.seven.entries.find(
            (d) => d.competition_id === c.id,
          );
          state.seven.entries = state.seven.entries.filter(
            (d) => d.competition_id !== c.id,
          );
          state.seven.entries.push({
            competition_id: c.id,
            revision: (old?.revision ?? 0) + 1,
            updated_at: new Date().toISOString(),
            snapshot: picks.map((p: { slot: string; card: string }) => {
              const card = state.cards.find((c) => c.id === p.card)!;
              return {
                ...card,
                card_id: card.id,
                slot: p.slot,
                kickoff: future,
                salary: salary(card.tier),
                multiplier: rarityRule(card.tier).multiplierTenths / 10,
              };
            }),
          });
        }
      } else if (req.action === "seven_withdraw")
        state.seven.entries = state.seven.entries.filter(
          (e) => e.competition_id !== c.id,
        );
      else if (req.action === "name_team") state.team_name = req.payload.name;
      else throw Error("This action is not enabled in the visual fixture");
      sessionStorage.setItem(fixtureKey, JSON.stringify(state));
    }
    return Response.json({ state: structuredClone(state), result: {} });
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : "Local fixture error",
        outcome: "rejected",
      },
      { status: 400 },
    );
  }
};

function LocalWallet() {
  const [value, setValue] = useState<
    import("../../src/core/member-test-wallet").MemberTestView | null
  >(null);
  useEffect(() => {
    void fetch("/api/test-wallet")
      .then((r) => r.json())
      .then((r) => setValue(r.state));
  }, []);
  return value ? (
    <MemberTestWallet
      initial={value}
      surface={
        new URLSearchParams(location.search).get("view") === "packs"
          ? "packs"
          : "wallet"
      }
    />
  ) : (
    <p>Loading local wallet…</p>
  );
}
function Fixture({ member }: { member: string }) {
  const path = location.pathname;
  Object.assign(window, { demoPath: path });
  const [open, setOpen] = useState(false),
    [detail, setDetail] = useState<(typeof cards)[number] | null>(null);
  const tab = path.split("/")[2] || "play";
  if (path === "/preview/rarity-frames")
    return <RarityGallery base={cards[3]} />;
  return (
    <EnvironmentProvider
      value={{
        production: true,
        liveBeta: true,
        registrationAvailable: false,
        emailAvailable: false,
        invitationAllowed: false,
        policyVersions: null,
        accountConfigured: true,
        reason: "",
      }}
    >
      <AppShell authenticated>
        {tab === "results" ? (
          <CompetitionResults
            rounds={[]}
            records={[]}
            standings={[]}
            weekly={standingsFixture}
          />
        ) : tab === "market" ? (
          <Marketplace member={member} />
        ) : tab === "test-wallet" ? (
          <LocalWallet />
        ) : tab === "reveal" ? (
          <>
            <h1>Pack preview</h1>
            <p>Illustrative cards only. No awards or charges.</p>
            <button onClick={() => setOpen(true)}>
              Open nine-card preview
            </button>
          </>
        ) : tab === "social" ? (
          <>
            <h1 className="compact-page-title">Social</h1>
            <p className="small-note">
              Local visual preview. Posting is unavailable here.{" "}
              <a href="https://docked.com.au/fantasy/social">
                Open your live feed
              </a>
            </p>
            <SocialComposer initialSport="nfl" inline />
            <nav className="actions">
              <a href="/fantasy/social">Following</a>
              <a href="/fantasy/social">Discover</a>
            </nav>
            <article
              className="social-card app-panel"
              style={{
                background: "#142037",
                color: "white",
                padding: 16,
                borderRadius: 16,
              }}
            >
              <strong>Local member</strong>
              <p>
                Ready for the next round. Which position are you strengthening?
              </p>
            </article>
          </>
        ) : (
          <FantasyScreen tab={tab} initial={state} packExperience />
        )}
        {open && (
          <PackOpening
            name="Premium · nine cards"
            userId="visual-member"
            receipt={{
              id: "visual-nine-v1",
              name: "Premium",
              opened_at: now,
              cards: cards.map((c, i) => {
                const tier = [
                  "RARE",
                  "RARE",
                  "ELITE",
                  "ULTRA_RARE",
                  "LEGENDARY",
                  "ICON",
                  "RARE",
                  "RARE",
                  "RARE",
                ][i];
                return {
                  ...c,
                  tier,
                  serial: tier === "ICON" ? 1 : c.serial,
                  max_supply: rarityRule(tier).lifetimeCap ?? 0,
                };
              }),
            }}
            openPack={async () => {
              throw Error("Visual only");
            }}
            ownedIds={cards.map((c) => c.id)}
            onClose={() => setOpen(false)}
            onViewCard={(c) => setDetail(c as (typeof cards)[number])}
            preview
          />
        )}
        {detail && (
          <FantasySheet title={detail.name} onClose={() => setDetail(null)}>
            <FantasyCardArtwork card={detail} />
          </FantasySheet>
        )}
      </AppShell>
    </EnvironmentProvider>
  );
}
fetch("/local-identity")
  .then((r) => r.json())
  .then(({ member }) =>
    createRoot(document.getElementById("fixture-root")!).render(
      <Fixture member={member} />,
    ),
  );
