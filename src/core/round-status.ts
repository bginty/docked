export function playerScoreStatus(
  status: string,
  fixtures: { scheduledAt: string; status?: string }[] = [],
  now = Date.now(),
) {
  if (status === "dnp") return "Did not play";
  if (status === "bye") return "Bye";
  if (
    fixtures.some((f) =>
      ["postponed", "cancelled", "under-review"].includes(f.status ?? ""),
    )
  )
    return "Results under review";
  if (
    fixtures.length &&
    fixtures.every(
      (f) =>
        Date.parse(f.scheduledAt) > now &&
        !["live", "in_progress", "final", "completed"].includes(f.status ?? ""),
    )
  )
    return "Game not started";
  if (fixtures.some((f) => ["live", "in_progress"].includes(f.status ?? "")))
    return "Game in progress · scores available after the game";
  return (
    (
      {
        "pending-data": "Awaiting player statistics",
        pending: "Awaiting player statistics",
        provisional: "Results under review",
        final: "Final",
        "under-review": "Results under review",
        bye: "Bye",
        dnp: "Did not play",
      } as Record<string, string>
    )[status] ?? "Awaiting player statistics"
  );
}
export function roundProgress(input: {
  closesAt: string;
  finalised: boolean;
  visible?: boolean;
  fixtures: { scheduledAt: string; status?: string }[];
  completeScores?: boolean;
  now: number;
}) {
  const started = input.fixtures.filter(
    (f) =>
      Number.isFinite(Date.parse(f.scheduledAt)) &&
      Date.parse(f.scheduledAt) <= input.now,
  ).length;
  const unstarted = input.fixtures.some(
    (f) => Date.parse(f.scheduledAt) > input.now,
  );
  const inProgress = input.fixtures.some((f) =>
    ["live", "in_progress"].includes(f.status ?? ""),
  );
  const review =
    input.visible === false ||
    input.fixtures.some(
      (f) =>
        !Number.isFinite(Date.parse(f.scheduledAt)) ||
        ["postponed", "cancelled", "under-review"].includes(f.status ?? ""),
    );
  const label = review
    ? "Results under review"
    : input.finalised &&
        !unstarted &&
        !inProgress &&
        input.fixtures.length > 0 &&
        input.completeScores !== false
      ? "Final results"
      : Date.parse(input.closesAt) > input.now
        ? "Entries open"
        : unstarted || inProgress
          ? "Entries closed · round in progress"
          : input.completeScores
            ? "Results under review"
            : "Awaiting player statistics";
  return {
    label,
    started,
    total: input.fixtures.length,
    provisional: started > 0 && label !== "Final results",
  };
}
