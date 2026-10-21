import { nflSeven } from "./nfl-seven";

/** Stable catalogue IDs: EPL remains football; NBA will use basketball. */
export type LineupConfiguration = typeof nflSeven & { sport?: string };
export type PositionGroup = { id: string; label: string; slots: string[] };
export type SportConfiguration = {
  id: string;
  label: string;
  formatVersion: string;
  formatStatus: "approved" | "proposal" | "existing";
  field: "gridiron" | "oval" | "pitch" | "court";
  period: "round" | "gameweek" | "weekly-window";
  groups: PositionGroup[];
  slots: { id: string; positions: string[] }[];
  publicEnabled: boolean;
  scoringVersion: string | null;
  salaryCap: number | null;
  issuanceApproved: boolean;
};
const group = (id: string, label: string, count: number) => ({
  id,
  label,
  slots: Array.from({ length: count }, (_, i) => `${id}${i + 1}`),
});
const aflGroups = [
  group("BACK", "Backs", 6),
  group("MID", "Midfielders", 8),
  group("FWD", "Forwards", 6),
  group("RUCK", "Rucks", 2),
];
export const aflConfiguration: SportConfiguration = {
  id: "afl",
  label: "AFL",
  formatVersion: "docked-afl-22-v1",
  formatStatus: "approved",
  field: "oval",
  period: "round",
  groups: aflGroups,
  slots: aflGroups.flatMap((g) =>
    g.slots.map((id) => ({
      id,
      positions: [g.id === "BACK" ? "DEF" : g.id === "RUCK" ? "RUC" : g.id],
    })),
  ),
  publicEnabled: false,
  scoringVersion: "docked-afl-22-events-v1",
  salaryCap: null,
  issuanceApproved: false,
};
function proposedSport(
  id: string,
  label: string,
  field: SportConfiguration["field"],
  period: SportConfiguration["period"],
  groups: PositionGroup[],
  positions: Record<string, string[]>,
): SportConfiguration {
  return {
    id,
    label,
    field,
    period,
    groups,
    slots: groups.flatMap((g) =>
      g.slots.map((id) => ({ id, positions: positions[g.id] ?? [g.id] })),
    ),
    formatVersion: `docked-${id}-${groups.reduce((n, g) => n + g.slots.length, 0)}-v1`,
    formatStatus: "proposal",
    publicEnabled: false,
    scoringVersion:
      id === "nrl"
        ? "docked-nrl-events-v1"
        : id === "basketball"
          ? "docked-nba-events-v1"
          : "docked-epl-beta-v1",
    salaryCap: null,
    issuanceApproved: false,
  };
}
export const nrlConfiguration = proposedSport(
  "nrl",
  "NRL",
  "pitch",
  "round",
  [
    group("WFB", "Fullbacks / Wings", 2),
    group("CTR", "Centres", 2),
    group("HLF", "Halves", 2),
    group("EDG", "Edge forwards", 3),
    group("MID", "Middle forwards", 3),
    group("FLEX", "Flex", 1),
  ],
  { FLEX: ["WFB", "CTR", "HLF", "EDG", "MID"] },
);
export const nbaConfiguration = proposedSport(
  "basketball",
  "NBA",
  "court",
  "weekly-window",
  [
    group("PG", "Point guard", 1),
    group("SG", "Shooting guard", 1),
    group("SF", "Small forward", 1),
    group("PF", "Power forward", 1),
    group("C", "Centre", 1),
    group("FLEX", "Flex", 3),
  ],
  { FLEX: ["PG", "SG", "SF", "PF", "C"] },
);
export const eplConfiguration: SportConfiguration = {
  ...proposedSport(
    "football",
    "EPL",
    "pitch",
    "gameweek",
    [
      group("GK", "Goalkeeper", 1),
      group("DEF", "Defenders", 4),
      group("MID", "Midfielders", 4),
      group("FWD", "Forwards", 2),
    ],
    {},
  ),
  formatStatus: "existing",
};
export const sportConfigurations: Record<string, SportConfiguration> = {
  nfl: {
    id: "nfl",
    label: "NFL",
    formatVersion: nflSeven.version,
    formatStatus: "existing",
    field: "gridiron",
    period: "round",
    groups: [],
    slots: nflSeven.slots,
    publicEnabled: true,
    // NFL round snapshots, not this catalogue, remain authoritative for scoring/cap.
    scoringVersion: null,
    salaryCap: nflSeven.salaryCap,
    issuanceApproved: true,
  },
  afl: aflConfiguration,
  nrl: nrlConfiguration,
  basketball: nbaConfiguration,
  football: eplConfiguration,
};

export function sportActivationBlockers(config: SportConfiguration) {
  return [
    ...(config.formatStatus === "proposal" ? ["Lineup format approval"] : []),
    ...(config.scoringVersion === null
      ? ["Versioned scoring rules approval"]
      : []),
    ...(config.salaryCap === null ? ["Traditional salary model approval"] : []),
    ...(!config.issuanceApproved
      ? ["Scarcity, pack prices and issuance approval"]
      : []),
    "Configured statistics source and verified active-player catalogue",
    "Public activation approval",
  ];
}
