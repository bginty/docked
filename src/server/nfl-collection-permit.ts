import postgame from "../../config/nfl-postgame-permit.json";
import roster from "../../config/nfl-roster-permit.json";

/** The roster review is separate from statistics/scoring. Deploying its reviewed
 * renewal must never renew the expired play-by-play or weekly-statistics permit. */
export function nflCollectionPermit(
  task: "weekly" | "pbp" | "rosters" | "reconcile",
) {
  return task === "rosters" ? roster : postgame;
}
