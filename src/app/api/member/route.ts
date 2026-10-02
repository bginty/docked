import { NextResponse } from "next/server";
import { z } from "zod";
import { DateTime } from "luxon";
import { createClient } from "@supabase/supabase-js";
import { requireIdentity, sameOrigin, authClient } from "@/server/auth";
import { db, rateLimit } from "@/server/db";
import { publicTips } from "@/server/queries";
const preferenceSchema = z.object({
  timezone: z.string().refine((v) => DateTime.now().setZone(v).isValid),
  oddsFormat: z.enum(["decimal", "fractional", "american"]),
  digest: z.enum(["off", "weekly", "twice_weekly"]),
  edgeAlerts: z.boolean(),
  education: z.boolean(),
  paused: z.boolean(),
  sports: z.array(z.string().max(60)).max(10),
  leagues: z.array(z.string().max(60)).max(20),
  bookmakers: z.array(z.string().max(60)).max(20),
});
export async function GET() {
  try {
    const who = await requireIdentity(),
      sql = db();
    const [preferences, saved, personal, consent] = await Promise.all([
      sql`select * from public.notification_preferences where user_id=${who.user.id}`,
      sql`select tip_id,created_at from public.saved_tips where user_id=${who.user.id}`,
      sql`select * from public.personal_entries where user_id=${who.user.id}`,
      sql`select purpose,granted,version,created_at from private.consent_events where user_id=${who.user.id}`,
    ]);
    return NextResponse.json(
      { profile: who.profile, preferences, saved, personal, consent },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition": "attachment; filename=docked-account.json",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Origin denied" }, { status: 403 });
  try {
    const who = await requireIdentity(),
      sql = db();
    if (!(await rateLimit(`member:${who.user.id}`, 30)))
      return NextResponse.json({ error: "Rate limit" }, { status: 429 });
    const body = await request.json();
    if (body.action === "preferences") {
      const v = preferenceSchema.parse(body);
      await sql.begin(async (tx) => {
        await tx`update public.profiles set timezone=${v.timezone},odds_format=${v.oddsFormat},sports=${v.sports},leagues=${v.leagues},bookmakers=${v.bookmakers} where id=${who.user.id}`;
        await tx`update public.notification_preferences set digest=${v.digest},edge_alerts=${v.edgeAlerts},education=${v.education},paused=${v.paused},updated_at=now() where user_id=${who.user.id}`;
        for (const [purpose, granted] of Object.entries({
          digest: v.digest !== "off",
          education: v.education,
          edge: v.edgeAlerts,
        }))
          await tx`insert into private.consent_events(user_id,purpose,granted,version,actor) values(${who.user.id},${purpose},${granted},'2026-10',${who.user.id})`;
        await tx`update private.outbox set state='suppressed',last_error='Consent revoked or paused' where user_id=${who.user.id} and state in ('queued','leased') and kind<>'service' and (${v.paused} or (kind='edge' and ${!v.edgeAlerts}) or (kind='digest' and ${v.digest === "off"}) or (kind='education' and ${!v.education}))`;
      });
      return NextResponse.json({ ok: true, message: "Preferences saved." });
    }
    if (body.action === "save") {
      const id = z.string().uuid().parse(body.tipId);
      const tips = await publicTips();
      if (!tips.some((t) => t.id === id)) throw new Error("Tip not accessible");
      await sql`insert into public.saved_tips(user_id,tip_id) values(${who.user.id},${id}) on conflict do nothing`;
      return NextResponse.json({ ok: true, message: "Tip saved." });
    }
    if (body.action === "personal") {
      const v = z
        .object({
          label: z.string().min(1).max(160),
          odds: z.coerce.number().gt(1).max(10000),
          result: z.enum(["pending", "won", "lost", "void"]),
        })
        .parse(body);
      await sql`insert into public.personal_entries(user_id,label,odds,result) values(${who.user.id},${v.label},${v.odds},${v.result})`;
      return NextResponse.json({
        ok: true,
        message:
          "Personal record saved. This never enters the official Docked ledger.",
      });
    }
    if (body.action === "delete") {
      if (body.confirm !== "DELETE")
        return NextResponse.json(
          { error: "Type DELETE to confirm" },
          { status: 400 },
        );
      await sql.begin(async (tx) => {
        await tx`update public.profiles set disabled_at=now() where id=${who.user.id}`;
        await tx`update private.outbox set state='suppressed' where user_id=${who.user.id} and state in ('queued','leased')`;
        await tx`delete from auth.sessions where user_id=${who.user.id}`;
        await tx`insert into private.audit_events(actor,action,subject) values('account-service','account_deletion',${who.user.id})`;
      });
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!,
        { auth: { persistSession: false } },
      );
      const { error } = await admin.auth.admin.deleteUser(who.user.id);
      if (error)
        throw new Error(
          "Deletion queued for operator review; account access disabled",
        );
      await (await authClient())?.auth.signOut();
      return NextResponse.json({ ok: true, redirect: "/" });
    }
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch {
    return NextResponse.json(
      {
        error: "Request could not be completed. Check your session and inputs.",
      },
      { status: 403 },
    );
  }
}
