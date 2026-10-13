import type { Rules } from "./scoring-v1";
import type { nflSeven } from "./nfl-seven";
export type ReviewRound = {
  id: string;
  name: string;
  season: string;
  week: number;
  mode: string;
  closesAt: string;
  finalAt: string | null;
  entryCount: number;
  entered: boolean;
  updatedAt: string | null;
  rules: Rules;
  lineup: typeof nflSeven | null;
  visible: boolean;
  streamId: string;
};
export type ReviewContext = {
  rounds: ReviewRound[];
  cardHistory: Record<string, { at: number; event: string }[]>;
};
export function roundStatus(
  r: ReviewRound,
  hasScores: boolean,
  now = Date.now(),
) {
  if (!r.entryCount) return "No entries yet";
  if (Date.parse(r.closesAt) > now) return "Games have not started";
  if (r.finalAt) return "Results available · Final";
  if (hasScores) return "Results available · Provisional";
  return "Awaiting statistics · games may be underway; post-game scoring only";
}
