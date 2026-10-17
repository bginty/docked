import { readFile } from "node:fs/promises";
import { requireNflHostedTarget } from "../../../../../core/nfl-hosted-target.mjs";
import { connectTestingFeedDatabase } from "../../../../../server/nfl-testing-connection";
import {
  maxBatchBytes,
  readSignedBatch,
} from "../../../../../server/nfl-testing-batch";
import { NflTestingStore } from "../../../../../server/nfl-testing-store";
import { requirePostgamePermit } from "../../../../../server/postgame-download";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
// No member cookies or production credentials. Restricted raw-feed writer only;
// this endpoint cannot create entries, award team points or modify assets.
export async function POST(request: Request) {
  const reply = (body: object, status: number) =>
    Response.json(body, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.NFL_BATCH_IMPORT_ENABLED !== "true"
  )
    return reply({ error: "Unavailable" }, 404);
  let connection: ReturnType<typeof connectTestingFeedDatabase> | undefined;
  try {
    const target = requireNflHostedTarget();
    if (
      target.transport !== "signed-batch" ||
      new URL(request.url).origin !== target.batchImportOrigin ||
      process.env.VERCEL_PROJECT_ID !== target.vercelProjectId
    )
      return reply({ error: "Unavailable" }, 404);
    requirePostgamePermit(
      JSON.parse(await readFile("config/nfl-postgame-permit.json", "utf8")),
      new Date(),
    );
    const key = process.env.NFL_BATCH_KEY ?? "";
    if (key.length < 32) return reply({ error: "Unavailable" }, 503);
    if (
      request.headers.get("content-type") !== "application/octet-stream" ||
      request.headers.has("content-encoding")
    )
      return reply({ error: "Binary batch required" }, 415);
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Missing batch" }, 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
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
      target.dataset,
    );
    connection = connectTestingFeedDatabase(
      process.env.NFL_BATCH_WRITER_DATABASE_URL ?? "",
      "preview",
    );
    await connection.verify();
    const role = (await connection.db.query("select current_user role")).rows[0]
      ?.role;
    if (role !== target.writerRole) throw Error("Restricted writer required");
    const generation = await new NflTestingStore(connection.db).sync(
      batch.client,
      false,
      batch.receipt,
    );
    return reply(
      {
        status: "imported",
        generation,
        digest: batch.receipt.hash,
        ...batch.counts,
        scope: "isolated raw statistics; no competition settlement",
      },
      200,
    );
  } catch {
    // Do not reflect credentials, payloads, SQL errors or member information.
    return reply(
      {
        error:
          "Batch rejected or import incomplete; retry the same batch after checking test health",
      },
      422,
    );
  } finally {
    await connection?.close();
  }
}
