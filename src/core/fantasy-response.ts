/** A database error reporting a rolled-back transaction can release a retry key.
 * Transport failures, disconnects and response serialization errors cannot. */
export function fantasyFailureOutcome(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error ? error.code : null;
  const rolledBack =
    typeof code === "string" &&
    [
      "P0001",
      "23502",
      "23503",
      "23505",
      "23514",
      "22023",
      "22P02",
      "40001",
      "40P01",
      "42501",
    ].includes(code);
  return rolledBack
    ? {
        status: 409,
        outcome: "rejected" as const,
        error:
          "Action was rejected. Check access, ownership, availability, eligibility and round lock.",
      }
    : {
        status: 503,
        outcome: "unconfirmed" as const,
        error:
          "The transaction outcome could not be confirmed. Retry the same pending action to check its saved result.",
      };
}

// A rejected retry says nothing about whether an earlier ambiguous attempt
// committed. Only a successful receipt replay can resolve that uncertainty.
export function fantasyResponseRejects(
  status: number,
  body: unknown,
  previouslyUnconfirmed = false,
) {
  return (
    !previouslyUnconfirmed &&
    status >= 400 &&
    status < 500 &&
    !!body &&
    typeof body === "object" &&
    "outcome" in body &&
    body.outcome === "rejected"
  );
}
