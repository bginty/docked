import { NextResponse } from "next/server";
import { z } from "zod";
import { DateTime } from "luxon";
import { requireIdentity, sameOrigin, authClient } from "@/server/auth";
import { db, rateLimit } from "@/server/db";
import { publicTips } from "@/server/queries";
import { processAccountDeletion } from "@/server/account-deletion";
import { recordAnalytics } from "@/server/analytics";
const preferenceSchema = z.object({
  timezone: z.string().refine((v) => DateTime.now().setZone(v).isValid),
  oddsFormat: z.enum(["decimal", "fractional", "american"]),
  digest: z.enum(["off", "weekly", "twice_weekly"]),
  edgeAlerts: z.boolean(),
  education: z.boolean(),
  analytics: z.boolean().optional().default(false),
  paused: z.boolean(),
  sports: z.array(z.string().max(60)).max(10),
  leagues: z.array(z.string().max(60)).max(20),
  bookmakers: z.array(z.string().max(60)).max(20),
});
export async function GET() {
  try {
    const who = await requireIdentity(),
      sql = db();
    const [preferences, saved, personal, consent, analytics] =
      await Promise.all([
        sql`select * from public.notification_preferences where user_id=${who.user.id}`,
        sql`select tip_id,created_at from public.saved_tips where user_id=${who.user.id}`,
        sql`select * from public.personal_entries where user_id=${who.user.id}`,
        sql`select purpose,granted,version,created_at from private.consent_events where user_id=${who.user.id}`,
        sql`select event,channel,created_at from private.analytics_events where user_id=${who.user.id} order by created_at`,
      ]);
    return NextResponse.json(
      {
        profile: who.profile,
        preferences,
        saved,
        personal,
        consent,
        analytics,
      },
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
    if (body.action === "jurisdiction") {
      const v = z
        .object({
          country: z.string().regex(/^[A-Z]{2}$/),
          state: z.string().min(1).max(50),
          age: z.literal(true),
          terms: z.literal(true),
        })
        .parse(body);
      await sql.begin(async (tx) => {
        await tx`update public.profiles set country=${v.country},state=${v.state},age_attested=true,accepted_version='2026-10-draft' where id=${who.user.id}`;
        await tx`update public.notification_preferences set paused=true,updated_at=now() where user_id=${who.user.id}`;
        await tx`update private.outbox set state='suppressed',last_error='Jurisdiction changed; review preferences' where user_id=${who.user.id} and kind<>'service' and state in ('queued','leased')`;
        await tx`insert into private.consent_events(user_id,purpose,granted,version,actor) values(${who.user.id},'terms',true,'2026-10-draft',${who.user.id})`;
        await tx`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},'jurisdiction_changed',${who.user.id},${tx.json({ country: v.country, state: v.state })})`;
      });
      return NextResponse.json({
        ok: true,
        message:
          "Jurisdiction updated. Optional alerts paused until you review preferences; server-side eligibility still applies.",
      });
    }
    if (body.action === "preferences") {
      const v = preferenceSchema.parse(body);
      const previous =
        await sql`select digest,edge_alerts,paused from public.notification_preferences where user_id=${who.user.id}`;
      await sql.begin(async (tx) => {
        await tx`update public.profiles set timezone=${v.timezone},odds_format=${v.oddsFormat},sports=${v.sports},leagues=${v.leagues},bookmakers=${v.bookmakers},onboarding_completed_at=coalesce(onboarding_completed_at,now()) where id=${who.user.id}`;
        await tx`update public.notification_preferences set digest=${v.digest},edge_alerts=${v.edgeAlerts},education=${v.education},paused=${v.paused},updated_at=now() where user_id=${who.user.id}`;
        for (const [purpose, granted] of Object.entries({
          digest: v.digest !== "off",
          education: v.education,
          edge: v.edgeAlerts,
          analytics: v.analytics,
        }))
          await tx`insert into private.consent_events(user_id,purpose,granted,version,actor) values(${who.user.id},${purpose},${granted},'2026-10',${who.user.id})`;
        await tx`update private.outbox set state='suppressed',last_error='Consent revoked or paused' where user_id=${who.user.id} and state in ('queued','leased') and kind<>'service' and (${v.paused} or (kind='edge' and ${!v.edgeAlerts}) or (kind='digest' and ${v.digest === "off"}) or (kind='education' and ${!v.education}))`;
      });
      if (!who.profile.onboarding_completed_at)
        await recordAnalytics(
          who.user.id,
          "onboarding_completed",
          undefined,
          true,
        );
      if (JSON.stringify(who.profile.sports) !== JSON.stringify(v.sports))
        await recordAnalytics(who.user.id, "sport_selected");
      if (
        JSON.stringify(who.profile.bookmakers) !== JSON.stringify(v.bookmakers)
      )
        await recordAnalytics(who.user.id, "bookmaker_selected");
      const before = previous[0];
      if (
        (!!before?.edge_alerts && !before?.paused) !==
        (v.edgeAlerts && !v.paused)
      )
        await recordAnalytics(
          who.user.id,
          v.edgeAlerts && !v.paused ? "alert_enabled" : "alert_disabled",
        );
      if (
        (before?.digest !== "off" && !before?.paused) !==
        (v.digest !== "off" && !v.paused)
      )
        await recordAnalytics(
          who.user.id,
          v.digest !== "off" && !v.paused
            ? "digest_enabled"
            : "digest_disabled",
        );
      return NextResponse.json({ ok: true, message: "Preferences saved." });
    }
    if (body.action === "save") {
      const id = z.string().uuid().parse(body.tipId);
      const tips = await publicTips();
      if (!tips.some((t) => t.id === id)) throw new Error("Tip not accessible");
      const saved =
        await sql`insert into public.saved_tips(user_id,tip_id) values(${who.user.id},${id}) on conflict do nothing returning tip_id`;
      if (saved.length) await recordAnalytics(who.user.id, "tip_saved");
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
      await sql`select private.disable_account(${who.user.id})`;
      let pending = false;
      try {
        await processAccountDeletion(who.user.id);
      } catch {
        pending = true;
      }
      await (await authClient())?.auth.signOut();
      return NextResponse.json(
        {
          ok: true,
          redirect: "/",
          message: pending
            ? "Account access revoked. Identity erasure is queued for retry."
            : "Account deleted. Pseudonymous audit evidence is retained under the reviewed retention policy.",
        },
        { status: pending ? 202 : 200 },
      );
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
