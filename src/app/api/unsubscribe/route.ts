import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { hash } from "@/core/canonical-hash";
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token || token.length < 32 || !process.env.DATABASE_URL)
    return NextResponse.json(
      { error: "Invalid unsubscribe link" },
      { status: 400 },
    );
  const sql = db();
  const rows =
    await sql`select user_id from private.unsubscribe_tokens where token_hash=${hash(token)}`;
  if (!rows[0])
    return NextResponse.json(
      { error: "Invalid unsubscribe link" },
      { status: 400 },
    );
  const id = rows[0].user_id;
  await sql.begin(async (tx) => {
    await tx`update public.notification_preferences set paused=true,digest='off',edge_alerts=false,education=false,updated_at=now() where user_id=${id}`;
    await tx`update private.outbox set state='suppressed',last_error='Unsubscribed' where user_id=${id} and kind<>'service' and state in ('queued','leased')`;
    for (const purpose of ["edge", "digest", "education"])
      await tx`insert into private.consent_events(user_id,purpose,granted,version,actor) values(${id},${purpose},false,'2026-10','one-click-unsubscribe')`;
  });
  return NextResponse.json({
    ok: true,
    message: "All optional communications paused.",
  });
}
