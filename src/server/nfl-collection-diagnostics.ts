/** Only bounded diagnostic codes reach private telemetry; never raw error text. */
export type CollectionStage = "retention" | "fetch" | "persist" | "completion";
export class CollectionFailure extends Error {
  constructor(
    readonly stage: CollectionStage,
    readonly diagnostic: string,
  ) {
    super("NFL source unavailable or changed; keep scores pending");
  }
}
export function collectionDiagnostic(error: unknown): string {
  if (!(error instanceof Error)) return "UNCLASSIFIED";
  const sqlCode = (error as Error & { code?: string }).code;
  if (sqlCode === "42501") return "DATABASE_PERMISSION_DENIED";
  if (sqlCode === "53300") return "DATABASE_CONNECTION_LIMIT";
  if (error.name === "TimeoutError" || error.name === "AbortError")
    return "SOURCE_TIMEOUT";
  if (/^NFL source HTTP [1-5][0-9]{2}$/.test(error.message))
    return error.message.replaceAll(" ", "_").toUpperCase();
  const known: Record<string, string> = {
    "Unexpected source redirect": "SOURCE_REDIRECT_REJECTED",
    "Unexpected NFL content type": "SOURCE_CONTENT_TYPE_REJECTED",
    "Missing source body": "SOURCE_BODY_MISSING",
    "Source download too large": "SOURCE_SIZE_LIMIT",
    "Invalid source timestamp": "SOURCE_TIMESTAMP_INVALID",
    "304 without retained evidence": "SOURCE_304_WITHOUT_EVIDENCE",
    "Lost source lease": "SOURCE_LEASE_LOST",
    "Retained source unavailable": "RETAINED_SOURCE_UNAVAILABLE",
    "Buffer is not defined": "RUNTIME_BUFFER_UNAVAILABLE",
  };
  return known[error.message] ?? "UNCLASSIFIED";
}
export function collectionFailureDetail(error: unknown) {
  return error instanceof CollectionFailure
    ? { stage: error.stage, diagnostic: error.diagnostic }
    : { stage: "worker", diagnostic: collectionDiagnostic(error) };
}
