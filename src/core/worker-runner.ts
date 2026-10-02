/** A bounded drain prevents one queued sport from starving the next sport. */
export async function drainJobs<T>(
  lease: () => Promise<T | null>,
  handle: (job: T) => Promise<void>,
  limit = 10,
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error("Invalid drain limit");
  let count = 0;
  while (count < limit) {
    const job = await lease();
    if (!job) break;
    await handle(job);
    count++;
  }
  return count;
}
export async function isolatedObservation(
  collect: () => Promise<void>,
  incident: () => Promise<void>,
) {
  try {
    await collect();
  } catch {
    await incident();
  }
}
