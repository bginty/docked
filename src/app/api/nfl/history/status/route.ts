import { historyReceiverEnabled } from "@/core/nfl-history-target";
import { readRefreshStatus } from "@/core/nfl-refresh-status";
import { openNflHistory } from "@/server/nfl-history-connection";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  if (!historyReceiverEnabled(process.env, new URL(request.url).origin)) return new Response(null, { status: 404 });
  let connection: ReturnType<typeof openNflHistory> | undefined;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw Error("Empty status");
    const chunks: Buffer[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 4096) { await reader.cancel(); throw Error("Too large"); }
      chunks.push(Buffer.from(value));
    }
    const event = readRefreshStatus(Buffer.concat(chunks), process.env.NFL_HISTORY_BATCH_KEY ?? "",
      request.headers.get("x-nfl-timestamp") ?? "", request.headers.get("x-nfl-signature") ?? "");
    connection = openNflHistory("writer");
    await connection.db.transaction(async (db) => {
      await db.query("select pg_advisory_xact_lock(71820349)");
      // Immutable audit records make retries safe without modifying feed freshness.
      await db.query(`insert into nfl_history.audit(action,detail)
        select 'refresh-status',$1::jsonb where not exists
        (select 1 from nfl_history.audit where action='refresh-status'
         and detail->>'runId'=$2 and detail->>'phase'=$3)`, [JSON.stringify(event), event.runId, event.phase]);
    });
    return Response.json({ accepted: event.runId });
  } catch { return Response.json({ error: "Status rejected" }, { status: 422 }); }
  finally { await connection?.close(); }
}
