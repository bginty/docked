import {
  historyReceiverEnabled,
  nflHistoryTarget,
} from "@/core/nfl-history-target";
import { openNflHistory } from "@/server/nfl-history-connection";
import { historyStore } from "@/server/nfl-history-store";
import { maxBatchBytes, readSignedBatch } from "@/server/nfl-testing-batch";
import { NflTestingStore } from "@/server/nfl-testing-store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST(request: Request) {
  const reply = (body: object, status: number) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!historyReceiverEnabled(process.env, new URL(request.url).origin))
    return reply({ error: "Unavailable" }, 404);
  const key = process.env.NFL_HISTORY_BATCH_KEY ?? "";
  if (key.length < 32) return reply({ error: "Unavailable" }, 503);
  if (
    request.headers.get("content-type") !== "application/octet-stream" ||
    request.headers.has("content-encoding")
  )
    return reply({ error: "Binary batch required" }, 415);
  let connection: ReturnType<typeof openNflHistory> | undefined;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Missing batch" }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > maxBatchBytes) {
        await reader.cancel();
        return reply({ error: "Batch too large" }, 413);
      }
      chunks.push(part.value);
    }
    const batch = readSignedBatch(
      Buffer.concat(chunks),
      key,
      request.headers.get("x-nfl-timestamp") ?? "",
      request.headers.get("x-nfl-signature") ?? "",
      nflHistoryTarget.dataset,
      Date.now(),
      nflHistoryTarget.audience,
      true,
    );
    connection = openNflHistory("writer");
    const generation = await new NflTestingStore(
      historyStore(connection.db),
    ).sync(batch.client, false, batch.receipt);
    return reply(
      {
        status: "imported",
        generation,
        digest: batch.receipt.hash,
        ...batch.counts,
        scope: "player history only; no competition settlement",
      },
      200,
    );
  } catch {
    return reply(
      {
        error:
          "History batch rejected or incomplete. Preserve the batch and retry after checking feed health.",
      },
      422,
    );
  } finally {
    await connection?.close();
  }
}
