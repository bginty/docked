export function playerScoreStatus(status: string) {
  return (
    (
      {
        "pending-data": "Awaiting player statistics",
        pending: "Awaiting player statistics",
        provisional: "Provisional",
        final: "Final",
        "under-review": "Under review",
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
    provisional: label !== "Final results",
  };
}
