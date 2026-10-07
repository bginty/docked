export type PendingFantasyRequest = {
  action: string;
  payload: Record<string, unknown>;
  request_id: string;
};
/** Keep the identity of an ambiguous request until the server confirms its outcome. */
export function fantasyRetry(
  previous: PendingFantasyRequest | null,
  action: string,
  payload: Record<string, unknown>,
  uuid: () => string,
): PendingFantasyRequest {
  if (previous) {
    if (
      previous.action !== action ||
      JSON.stringify(previous.payload) !== JSON.stringify(payload)
    )
      throw Error(
        "Retry the pending action before starting another transaction.",
      );
    return previous;
  }
  return { action, payload, request_id: uuid() };
}
