import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
export const refreshEvent = z.object({
  version: z.literal(1), runId: z.uuid(),
  phase: z.enum(["attempt", "source", "delivered", "failed"]),
  at: z.number().nonnegative(),
  sourceFetchedAt: z.number().nonnegative().nullable().optional(),
  sourceUpdatedAt: z.number().nonnegative().nullable().optional(),
  changedRecords: z.number().int().nonnegative().max(1000000).optional(),
  digest: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  error: z.string().regex(/^[A-Za-z]{1,60}$/).optional(),
}).strict();
export function readRefreshStatus(body: Buffer, key: string, timestamp: string, signature: string, now = Date.now()) {
  if (key.length < 32 || body.length > 4096 || !/^\d{10}$/.test(timestamp) ||
      Math.abs(now / 1000 - Number(timestamp)) > 300 || !/^[a-f0-9]{64}$/.test(signature)) throw Error("Invalid status");
  const expected = createHmac("sha256", key).update("/api/nfl/history/status\n" + timestamp + "\n").update(body).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) throw Error("Invalid status");
  const event = refreshEvent.parse(JSON.parse(body.toString("utf8")));
  if (event.at > now / 1000 + 300 || (event.phase === "delivered" && !event.digest)) throw Error("Invalid status");
  return event;
}
