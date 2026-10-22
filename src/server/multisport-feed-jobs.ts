import "server-only";
import { z } from "zod";
const jobSchema = z.object({
  id: z.string().max(200),
  kind: z.string(),
  state: z.string(),
  due: z.number(),
  attempts: z.number(),
  last_error: z.string().nullable(),
});
async function request(path: string, body?: { job_id: string }) {
  const origin = new URL(
    process.env.DOCKED_MULTI_FEED_ORIGIN ?? "https://disabled.invalid",
  );
  const key = process.env.DOCKED_MULTI_FEED_ADMIN_KEY;
  if (
    !key ||
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/"
  )
    throw Error("Feed not configured");
  const response = await fetch(new URL(path, origin), {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error("Feed operation unavailable");
  const text = await response.text();
  if (text.length > 262144) throw Error("Oversize");
  return JSON.parse(text) as unknown;
}
export async function multisportFeedJobs() {
  try {
    return z
      .object({ data: z.array(jobSchema).max(500) })
      .parse(await request("/admin/multisport/jobs")).data;
  } catch {
    return null;
  }
}
export async function retryMultisportFeedJob(id: string) {
  if (!id || id.length > 200) throw Error("Invalid job");
  await request("/admin/multisport/retry", { job_id: id });
}
