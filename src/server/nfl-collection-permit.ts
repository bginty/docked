import postgame from "../../config/nfl-postgame-permit.json";

/** Collection approval remains independent of retained season-catalogue use.
 * No rolling renewal is implied by deploying the catalogue correction. */
export function nflCollectionPermit(
  _task: "weekly" | "pbp" | "rosters" | "reconcile",
) {
  return postgame;
}
