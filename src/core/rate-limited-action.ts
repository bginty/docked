export type ActionRateBudget = {
  scope: string;
  limit: number;
  seconds?: number;
};

/** Consume a durable budget before reserving a business transaction connection. */
export async function rateLimitedAction<T>(
  authenticatedUserId: string,
  budget: ActionRateBudget | undefined,
  consume: (key: string, limit: number, seconds: number) => Promise<boolean>,
  action: () => Promise<T>,
): Promise<T> {
  if (
    budget &&
    !(await consume(
      `${budget.scope}:${authenticatedUserId}`,
      budget.limit,
      budget.seconds ?? 60,
    ))
  )
    throw new Error("Action rate limit");
  return action();
}
