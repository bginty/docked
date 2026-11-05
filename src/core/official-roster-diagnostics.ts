export type OfficialRosterStage = "fetch" | "parse" | "persist";

/** Only bounded classifications are retained. Never return a provider body,
 * exception message, source URL, header, SQL detail or credential. */
export function officialRosterDiagnostic(
  error: unknown,
  stage: OfficialRosterStage,
  httpStatus?: number,
) {
  const failure = error instanceof Error ? error : undefined;
  if (stage === "fetch") {
    if (
      typeof httpStatus === "number" &&
      Number.isInteger(httpStatus) &&
      httpStatus >= 300 &&
      httpStatus <= 599
    )
      return `SOURCE_HTTP_${httpStatus}`;
    if (failure?.name === "TimeoutError" || failure?.name === "AbortError")
      return "SOURCE_TIMEOUT";
    const cause = failure?.cause;
    if (cause instanceof Error && /^unexpected redirect$/i.test(cause.message))
      return "SOURCE_REDIRECT_REJECTED";
    return "SOURCE_TRANSPORT_UNAVAILABLE";
  }
  if (stage === "parse") {
    if (failure?.message === "Roster response exceeds limit")
      return "ROSTER_SIZE_LIMIT";
    if (
      failure?.message ===
      "Official roster incomplete; retain previous evidence"
    )
      return "ROSTER_INCOMPLETE";
    return "ROSTER_PARSE_FAILED";
  }
  const rawCode = (failure as (Error & { code?: unknown }) | undefined)?.code;
  const code = typeof rawCode === "string" ? rawCode : undefined;
  if (code === "42501") return "DATABASE_PERMISSION_DENIED";
  if (code === "40001" || code === "40P01") return "OBSERVATION_RETRY_REQUIRED";
  if (code === "53300") return "DATABASE_CONNECTION_LIMIT";
  if (code === "P0001" || code?.startsWith("23"))
    return "OBSERVATION_VALIDATION_REJECTED";
  return "OBSERVATION_WRITE_UNAVAILABLE";
}
