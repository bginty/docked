/** Static SQL identifiers only. Values/JSON never pass through this mapper.
 * Database grants on the dedicated role, not rewriting, enforce isolation.
 */
export const packAcceptanceSchemas = [
  "beta_fantasy",
  "beta_packs",
  "beta_private",
  "beta_public",
  "commercial_billing",
  "credits_sandbox",
  "nfl_roster",
  "private",
  "public_gameplay",
  "season_catalogue",
  "sports_feed",
] as const;
const identifiers = new RegExp(
  `\\b(${packAcceptanceSchemas.join("|")})\\.`,
  "g",
);
export function packAcceptanceStatement(text: string) {
  return text
    .replace(identifiers, (_, schema: string) => `b1_${schema}.`)
    .replace(/\bauth\.(uid|jwt)\(/g, "b1_acceptance.$1(");
}
