export type DeletionJob = {
  id: string;
  leaseToken: string;
  userId: unknown;
};
export type CommunityMaintenancePorts = {
  recoverExhausted: () => Promise<void>;
  leaseDeletion: () => Promise<DeletionJob | null>;
  deleteAccount: (userId: string) => Promise<void>;
  finishDeletion: (
    job: DeletionJob,
    elapsedMs: number,
    failed: boolean,
  ) => Promise<void>;
  purgeRetention: () => Promise<void>;
  fanout: () => Promise<{ processed: number; queued: number }>;
  incident: (
    kind: "account_deletion" | "retention" | "in_app",
  ) => Promise<void>;
};

/** One bounded maintenance pass. No provider, publication, CMS or email port exists. */
export async function runCommunityMaintenance(
  ports: CommunityMaintenancePorts,
  limit = 10,
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10)
    throw Error("Invalid maintenance limit");
  const result = {
    deletionJobs: 0,
    deleted: 0,
    deletionFailures: 0,
    retention: false,
    recipients: 0,
    notifications: 0,
    errors: 0,
  };
  await ports.recoverExhausted();
  for (let i = 0; i < limit; i++) {
    const job = await ports.leaseDeletion();
    if (!job) break;
    const started = Date.now();
    let failed = false;
    try {
      if (
        typeof job.userId !== "string" ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
          job.userId,
        )
      )
        throw Error("Invalid account-deletion identity");
      await ports.deleteAccount(job.userId);
      result.deleted++;
    } catch {
      failed = true;
      result.deletionFailures++;
      result.errors++;
    }
    // A failed lease-finalization stops the pass: never claim that a job was
    // durably finished when its acknowledgement failed. Lease expiry permits retry.
    await ports.finishDeletion(job, Date.now() - started, failed);
    result.deletionJobs++;
    if (failed) await ports.incident("account_deletion");
  }
  try {
    await ports.purgeRetention();
    result.retention = true;
  } catch {
    result.errors++;
    await ports.incident("retention");
  }
  try {
    const fanout = await ports.fanout();
    result.recipients = fanout.processed;
    result.notifications = fanout.queued;
  } catch {
    result.errors++;
    await ports.incident("in_app");
  }
  return result;
}
