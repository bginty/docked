import "server-only";
import { z } from "zod";
import { ingestionJobs } from "../core/multisport-health";
import { feedRequest } from "./multisport-feed-http";
import { requireRole } from "./auth";
import { rateLimit } from "./db";
function config() {
  return {
    origin: process.env.DOCKED_MULTI_FEED_ORIGIN ?? "https://disabled.invalid",
    key: process.env.DOCKED_MULTI_FEED_ADMIN_KEY ?? "",
  };
}
export async function multisportFeedJobs() {
  try {
    return ingestionJobs.parse(
      await feedRequest(config(), "/admin/multisport/jobs"),
    ).data;
  } catch {
    return null;
  }
}
export async function retryMultisportFeedJob(input: unknown) {
  const who = await requireRole(["owner"]);
  const d = z
    .object({
      job_id: z.string().min(1).max(200),
      request_id: z.uuid(),
      reason: z.string().trim().min(10).max(1000),
    })
    .strict()
    .parse(input);
  if (!(await rateLimit(`multi-feed-retry:${who.user.id}`, 6, 60)))
    throw Error("Wait before retrying");
  return feedRequest(config(), "/admin/multisport/retry", {
    ...d,
    actor: who.user.id,
  });
}
