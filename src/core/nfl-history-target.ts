import target from "../../config/nfl-history.json";
export { target as nflHistoryTarget };
export function historyDatabaseTarget(raw: string, role: "reader" | "writer") {
  const url = new URL(raw),
    expected = role === "reader" ? target.readerRole : target.writerRole;
  if (
    !target.approved ||
    !target.approvalReference ||
    target.competitionSettlement ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !/^aws-\d+-ap-southeast-2\.pooler\.supabase\.com$/.test(url.hostname) ||
    url.port !== "5432" ||
    url.pathname !== "/postgres" ||
    decodeURIComponent(url.username) !== `${expected}.${target.projectRef}` ||
    !url.password ||
    url.search ||
    url.hash
  )
    throw Error("Restricted player-history connection required");
  return expected;
}
export function historyReceiverEnabled(
  env: Record<string, string | undefined>,
  origin: string,
) {
  return (
    target.approved &&
    env.NFL_HISTORY_IMPORT_ENABLED === "true" &&
    env.VERCEL_ENV === "production" &&
    env.VERCEL_PROJECT_ID === target.vercelProjectId &&
    origin === target.origin &&
    Date.parse(target.reviewExpiresAt) > Date.now()
  );
}
