export type TrialStage =
  | "PREPARING"
  | "RESERVING"
  | "RESERVED"
  | "HTTP_REQUEST"
  | "HTTP_RESPONSE"
  | "QUOTA_PERSISTENCE"
  | "PAYLOAD_VALIDATION"
  | "PAYLOAD_VALIDATED"
  | "DATA_PERSISTENCE"
  | "COMPLETING";
export type TrialProgress = {
  stage: TrialStage;
  httpResponseReceived: boolean;
  httpStatus: number | null;
};
export const newTrialProgress = (): TrialProgress => ({
  stage: "PREPARING",
  httpResponseReceived: false,
  httpStatus: null,
});

/** Only fixed diagnostic vocabulary may leave a caught error. No message, stack or URL. */
export function trialFailureDiagnostics(
  error: unknown,
  progress: TrialProgress,
) {
  const candidate = error as { name?: unknown; code?: unknown } | null;
  const names = [
    "Error",
    "TypeError",
    "PostgresError",
    "AbortError",
    "TimeoutError",
    "SyntaxError",
    "ZodError",
    "AggregateError",
  ];
  const states = [
    "08000",
    "08003",
    "08006",
    "22P02",
    "23502",
    "23503",
    "23505",
    "23514",
    "25P02",
    "40001",
    "40P01",
    "42501",
    "42601",
    "42703",
    "42883",
    "42P01",
    "57014",
    "57P01",
    "P0001",
    "XX000",
  ];
  return {
    failureStage: progress.stage,
    httpResponseReceived: progress.httpResponseReceived,
    httpStatus: progress.httpStatus,
    errorClass:
      typeof candidate?.name === "string" && names.includes(candidate.name)
        ? candidate.name
        : "UnknownError",
    sqlState:
      typeof candidate?.code === "string" && states.includes(candidate.code)
        ? candidate.code
        : null,
  };
}

export function trackedTrialFetch(
  progress: TrialProgress,
  fetcher: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    progress.stage = "HTTP_REQUEST";
    const response = await fetcher(input, init);
    progress.stage = "HTTP_RESPONSE";
    progress.httpResponseReceived = true;
    progress.httpStatus =
      Number.isInteger(response.status) &&
      response.status >= 100 &&
      response.status <= 599
        ? response.status
        : null;
    return response;
  };
}
