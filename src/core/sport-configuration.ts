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
  scoringVersion: null,
  salaryCap: null,
  issuanceApproved: false,
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
    "Licensed provider and verified active-player catalogue",
    "Public activation approval",
  ];
}
