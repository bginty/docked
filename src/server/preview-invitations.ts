import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { db } from "./db";
import { authClient, requireRole } from "./auth";
import { setCommunityClaims } from "./community-social";
import { setPreviewCommunityContext } from "./preview-community";
import {
  requirePreviewEnvironment,
  previewSignupSchema,
  previewCapabilitySet,
} from "@/core/preview-testers";
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function redeemPreviewInvitation(input: unknown) {
  requirePreviewEnvironment();
  if (!process.env.SUPABASE_SECRET_KEY?.startsWith("sb_secret_"))
    throw Error("Preview account provisioning is unavailable");
  const v = previewSignupSchema.parse(input),
    sql = db();
  const reservation = randomUUID(),
    userId = randomUUID();
  const invitation = await sql.begin(async (tx) => {
    await setPreviewCommunityContext(tx);
    const [i] =
      await tx`select * from private.preview_beta_invitations where token_hash=${digest(v.invitationCode)} and email_hash=${digest(v.email)} and status='pending' for update`;
    if (!i) throw Error("Invitation unavailable");
    const [p] =
      await tx`select * from private.region_policies where id=${i.policy_id} for share`;
    const [valid] =
      await tx`select ${i.expires_at}::timestamptz>clock_timestamp() and ${p?.effective_from ?? null}::timestamptz<=clock_timestamp() and ${p?.effective_to ?? null}::timestamptz>clock_timestamp() and ${p?.review_at ?? null}::timestamptz>clock_timestamp() valid`;
    if (
      !valid.valid ||
      !p?.preview_community_only ||
      !p.approved ||
      p.minimum_age !== 18 ||
      p.operators.length !== 0
    )
      throw Error("Invitation unavailable");
    if (
      (
        await tx`select 1 from private.social_handle_history where handle=${v.username}`
      ).length
    )
      throw Error("Username unavailable");
    await tx`update private.preview_beta_invitations set status='reserved',reservation_id=${reservation},reserved_user_id=${userId} where id=${i.id}`;
    return i;
  });
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  try {
    const created = await admin.auth.admin.createUser({
      id: userId,
      email: v.email,
      password: v.password,
      email_confirm: true,
      app_metadata: {
        preview_invitation_confirmed: true,
        email_ownership_verified: false,
        preview_invitation_id: invitation.id,
        preview_reservation_id: reservation,
        preview_fixture: invitation.fixture === true,
      },
    });
    if (
      created.error ||
      created.data.user?.id !== userId ||
      created.data.user.email?.toLowerCase() !== v.email
    )
      throw Error("Invitation account creation unavailable");
    await sql.begin(async (tx) => {
      await setPreviewCommunityContext(tx);
      const [i] =
        await tx`select * from private.preview_beta_invitations where id=${invitation.id} for update`;
      const [p] =
        await tx`select * from private.region_policies where id=${i.policy_id} for share`;
      const [valid] =
        await tx`select ${i.expires_at}::timestamptz>clock_timestamp() and ${p.effective_from}::timestamptz<=clock_timestamp() and least(${p.effective_to}::timestamptz,${p.review_at}::timestamptz)>clock_timestamp() valid`;
      if (
        i.status !== "reserved" ||
        i.reservation_id !== reservation ||
        i.reserved_user_id !== userId ||
        !valid.valid ||
        !p.approved ||
        !p.preview_community_only
      )
        throw Error("Invitation expired or revoked");
      await tx`insert into public.profiles(id,country,state,age_attested,accepted_version) values(${userId},${v.country},${v.state},true,'2026-10-draft')`;
      await tx`insert into public.notification_preferences(user_id,paused,digest,education,edge_alerts) values(${userId},true,'off',false,false)`;
      for (const [purpose, granted] of Object.entries({
        age_attestation: true,
        terms: true,
        privacy: true,
        marketing: v.marketing,
        analytics: false,
      }))
        await tx`insert into private.consent_events(user_id,purpose,granted,version,actor) values(${userId},${purpose},${granted},${invitation.fixture === true ? "preview-fixture-2026-10" : "2026-10-draft"},${userId})`;
      const [social] =
        await tx`insert into private.social_profiles(user_id,handle,display_name) values(${userId},${v.username},${v.username}) returning id`;
      await tx`insert into private.social_notification_preferences(profile_id,in_app,social) values(${social.id},false,false)`;
      await tx`insert into private.preview_tester_access(user_id,policy_id,project_ref,expires_at,capabilities,granted_by,reason)
        values(${userId},${i.policy_id},'bckkllmndoxzpzdqrevb',least(clock_timestamp()+${i.grant_hours}*interval '1 hour',${p.effective_to}::timestamptz,${p.review_at}::timestamptz),${i.capabilities},${i.created_by},${i.reason})`;
      await tx`update private.preview_beta_invitations set status='redeemed',redeemed_user_id=${userId} where id=${i.id}`;
      await tx`insert into private.audit_events(actor,action,subject,details) values(${userId},'preview_invitation_account_created',${userId},'{"emailOwnershipVerified":false,"emailSent":false}'::jsonb)`;
    });
  } catch {
    // Never attach a grant to an existing email identity or blindly retry an uncertain creation.
    let cleanupPending = false;
    try {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error && error.code !== "user_not_found") cleanupPending = true;
      if (data.user?.app_metadata.preview_reservation_id === reservation) {
        // Also covers an uncertain database COMMIT response: revoke before remote erasure.
        await sql`select private.disable_account(id) from public.profiles where id=${userId}`;
        await sql`delete from auth.sessions where user_id=${userId}`;
        const deletion = await admin.auth.admin.deleteUser(userId);
        cleanupPending = !!deletion.error;
      }
    } catch {
      cleanupPending = true;
    }
    if (cleanupPending) {
      await sql`insert into private.audit_events(actor,action,subject,details) values('preview-account-service','preview_signup_erasure_retry_required',${userId},'{}'::jsonb)`;
    }
    await sql.begin(async (tx) => {
      await setPreviewCommunityContext(tx);
      await tx`update private.preview_beta_invitations set status='failed' where id=${invitation.id} and status='reserved' and reservation_id=${reservation}`;
    });
    throw Error(
      "Preview signup could not be completed. Request a new approved invitation.",
    );
  }
  const client = await authClient();
  const signed = await client!.auth.signInWithPassword({
    email: v.email,
    password: v.password,
  });
  if (signed.error)
    return {
      ok: true,
      redirect: "/app/login",
      message:
        "Preview account created. Sign in with your email and password. No email was sent.",
    };
  return {
    ok: true,
    redirect: "/app/onboarding",
    message:
      "Preview invitation confirms your test access; it does not verify email ownership. No email sent.",
  };
}

const adminSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("invite"),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    hours: z.number().int().min(1).max(168),
    capabilities: previewCapabilitySet,
    reason: z.string().trim().min(12).max(1000),
  }),
  z.object({
    action: z.literal("grant"),
    userId: z.string().uuid(),
    hours: z.number().int().min(1).max(168),
    capabilities: previewCapabilitySet,
    reason: z.string().trim().min(12).max(1000),
  }),
  z.object({
    action: z.literal("revoke_grant"),
    id: z.string().uuid(),
    reason: z.string().trim().min(12).max(1000),
  }),
  z.object({
    action: z.literal("revoke_invitation"),
    id: z.string().uuid(),
    reason: z.string().trim().min(12).max(1000),
  }),
]);
export async function previewTesterAdministration() {
  requirePreviewEnvironment();
  await requireRole(["owner", "admin", "auditor"]);
  const sql = db();
  const [grants, invitations] = await Promise.all([
    sql`select g.id,g.user_id,g.created_at,g.expires_at,g.revoked_at,g.capabilities,g.reason,s.handle from private.preview_tester_access g left join private.social_profiles s on s.user_id=g.user_id order by g.created_at desc limit 100`,
    sql`select id,status,created_at,expires_at,capabilities,reason from private.preview_beta_invitations order by created_at desc limit 100`,
  ]);
  return { grants, invitations };
}
export async function mutatePreviewTesterAdministration(input: unknown) {
  requirePreviewEnvironment();
  const who = await requireRole(["owner", "admin"]),
    v = adminSchema.parse(input);
  const token = randomBytes(32).toString("base64url");
  return db().begin(async (tx) => {
    await setCommunityClaims(tx, who);
    await tx`select private.assert_preview_beta_admin(),set_config('docked.preview_actor',${who.user.id},true)`;
    if (v.action === "revoke_grant") {
      const [g] =
        await tx`select id from private.preview_tester_access where id=${v.id} and revoked_at is null for update`;
      await tx`select private.assert_preview_beta_admin()`;
      if (!g) throw Error("Active grant required");
      await tx`update private.preview_tester_access set revoked_at=clock_timestamp(),revoked_by=${who.user.id},revocation_reason=${v.reason} where id=${g.id}`;
      return {
        ok: true,
        message:
          "Preview grant revoked immediately. Other regions and roles were unchanged.",
      };
    }
    if (v.action === "revoke_invitation") {
      const [i] =
        await tx`select id from private.preview_beta_invitations where id=${v.id} and status in ('pending','reserved') for update`;
      await tx`select private.assert_preview_beta_admin()`;
      if (!i) throw Error("Unused invitation required");
      await tx`update private.preview_beta_invitations set status='revoked' where id=${i.id}`;
      await tx`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},'preview_invitation_revocation_reason',${i.id},${tx.json({ reason: v.reason })})`;
      return { ok: true, message: "Invitation revoked." };
    }
    const [p] =
      await tx`select * from private.region_policies where preview_community_only and approved and minimum_age=18 and cardinality(operators)=0 and effective_from<=clock_timestamp() and least(effective_to,review_at)>clock_timestamp()+interval '5 minutes' order by effective_from desc,id desc limit 1 for share`;
    await tx`select private.assert_preview_beta_admin()`;
    if (!p) throw Error("Approved isolated preview policy required");
    if (v.action === "grant") {
      const [member] =
        await tx`select id from public.profiles where id=${v.userId} and disabled_at is null for share`;
      if (!member) throw Error("Active account required");
      await tx`select private.assert_preview_beta_admin()`;
      await tx`insert into private.preview_tester_access(user_id,policy_id,project_ref,expires_at,capabilities,granted_by,reason) values(${v.userId},${p.id},'bckkllmndoxzpzdqrevb',least(clock_timestamp()+${v.hours}*interval '1 hour',${p.effective_to}::timestamptz,${p.review_at}::timestamptz),${v.capabilities},${who.user.id},${v.reason})`;
      return {
        ok: true,
        message:
          "Preview tester approved. Legal acceptance and expiry still apply; no administrator role granted.",
      };
    }
    const [invitation] =
      await tx`insert into private.preview_beta_invitations(project_ref,policy_id,token_hash,email_hash,capabilities,expires_at,grant_hours,created_by,reason)
      values('bckkllmndoxzpzdqrevb',${p.id},${digest(token)},${digest(v.email)},${v.capabilities},least(clock_timestamp()+${v.hours}*interval '1 hour',${p.effective_to}::timestamptz,${p.review_at}::timestamptz),${v.hours},${who.user.id},${v.reason}) returning id`;
    return {
      ok: true,
      id: invitation.id,
      invitationCode: token,
      message:
        "Invitation created. Share this one-time code privately with its approved recipient. No email has been sent.",
    };
  });
}
