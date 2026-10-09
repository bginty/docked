import { NextResponse } from "next/server";
import { z } from "zod";
import { requireIdentity, sameOrigin, authClient } from "@/server/auth";
import { db, rateLimit } from "@/server/db";
import { processAccountDeletion } from "@/server/account-deletion";
import { currentConsentVersions } from "@/core/auth-readiness";
import { exportCommunityData } from "@/server/community-social";
import { saveAppOnboarding } from "@/server/app-onboarding";
import { boundedCommunityBody } from "@/core/community-social";
import { exportPreviewFixtureData } from "@/server/preview-export";
export async function GET() {
  try {
    const who = await requireIdentity(),
      sql = db();
    const [
      preferences,
      saved,
      personal,
      consent,
      analytics,
      community,
      appOnboarding,
      previewAccess,
      previewFixtureEvidence,
    ] = await Promise.all([
      sql`select * from public.notification_preferences where user_id=${who.user.id}`,
      sql`select tip_id,created_at from public.saved_tips where user_id=${who.user.id}`,
      sql`select * from public.personal_entries where user_id=${who.user.id}`,
      sql`select purpose,granted,version,created_at from private.consent_events where user_id=${who.user.id}`,
      sql`select event,channel,created_at from private.analytics_events where user_id=${who.user.id} order by created_at`,
      exportCommunityData(who.user.id),
      sql`select interests,version,completed_at from private.app_onboarding where user_id=${who.user.id}`,
      sql`select capabilities,created_at,expires_at,revoked_at from private.preview_tester_access where user_id=${who.user.id} order by created_at`,
      exportPreviewFixtureData(who.user.id),
    ]);
    return NextResponse.json(
      {
        profile: who.profile,
        preferences,
        saved,
        personal,
        consent,
        analytics,
        community,
        appOnboarding,
        previewAccess,
        previewFixtureEvidence,
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
    const body = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(request, 16000)),
    );
    if (body.action === "app_onboarding")
      return NextResponse.json(await saveAppOnboarding(body));
    if (body.action === "jurisdiction") {
      const v = z
        .object({
          country: z.string().regex(/^[A-Z]{2}$/),
          state: z.string().min(1).max(50),
          age: z.literal(true),
          terms: z.literal(true),
        })
        .parse(body);
      const versions = currentConsentVersions();
      await sql.begin(async (tx) => {
        await tx`update public.profiles set country=${v.country},state=${v.state},age_attested=true,accepted_version=${versions.terms} where id=${who.user.id}`;
        await tx`update public.notification_preferences set paused=true,updated_at=now() where user_id=${who.user.id}`;
        await tx`update private.outbox set state='suppressed',last_error='Jurisdiction changed; review preferences' where user_id=${who.user.id} and kind<>'service' and state in ('queued','leased')`;
        await tx`insert into private.consent_events(user_id,purpose,granted,version,actor) values(${who.user.id},'terms',true,${versions.terms},${who.user.id})`;
        await tx`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},'jurisdiction_changed',${who.user.id},${tx.json({ country: v.country, state: v.state })})`;
      });
      return NextResponse.json({
        ok: true,
        message:
          "Jurisdiction updated. Optional alerts paused until you review preferences; server-side eligibility still applies.",
      });
    }
    if (["preferences", "save", "personal"].includes(body.action))
      return NextResponse.json(
        {
          error:
            "This account workflow has been retired. Use app onboarding for sport preferences.",
        },
        { status: 410 },
      );
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
