import { signOutBetaSession } from "@/core/beta-signout";
import { authUsersRelation, authSessionsRelation } from "@/core/auth-relations";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authClient, sameOrigin } from "@/server/auth";
import { config } from "@/server/config";
import { db, rateLimit } from "@/server/db";
import { hash } from "@/core/canonical-hash";
import { recordAnalytics } from "@/server/analytics";
import { previewAuthEmailAllowed } from "@/server/preview-auth";
import { boundedCommunityBody } from "@/core/community-social";
import { signupUsername } from "@/core/preview-testers";
import { redeemPreviewInvitation } from "@/server/preview-invitations";
import {
  currentConsentVersions,
  explicitSignupConsent,
  productionAuthRequestDenial,
} from "@/core/auth-readiness";
import {
  persistSignupProfile,
  type SignupTransaction,
} from "@/server/signup-profile";
import type { TransactionSql } from "postgres";
import { productionInvitationsEnabled } from "@/core/auth-invitation";
import { verifiedInvitedUser } from "@/core/invitation-setup";
import { passwordResetFailure } from "@/core/auth-policy";
import { mfaFlow } from "@/server/mfa-flow";
function signupTransaction(tx: TransactionSql): SignupTransaction {
  return {
    query: async (text, parameters) => [...(await tx.unsafe(text, parameters))],
    savepoint: async (run) =>
      tx.savepoint(async (nested) => run(signupTransaction(nested))),
  };
}
const schema = z.object({
  action: z.enum([
    "signup",
    "login",
    "recover",
    "resend",
    "reset",
    "logout",
    "mfa_status",
    "mfa_enroll",
    "mfa_verify",
  ]),
  email: z.string().email().max(254).optional(),
  app: z.boolean().optional(),
  username: signupUsername.optional(),
  invitationCode: z.string().max(100).optional(),
  privacy: z.boolean().optional(),
  marketing: z.boolean().optional(),
  password: z.string().min(12).max(128).optional(),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  state: z.string().min(1).max(50).optional(),
  age: z.boolean().optional(),
  terms: z.boolean().optional(),
  digest: z.boolean().optional(),
  education: z.boolean().optional(),
  analytics: z.boolean().optional(),
  edgeAlerts: z.literal(false).optional(),
  next: z.string().max(80).optional(),
  code: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Origin denied" }, { status: 403 });
  if (
    process.env.DOCKED_BETA_STAGING === "true" &&
    process.env.BETA_ACCESS_ENABLED !== "true"
  )
    return NextResponse.json(
      { error: "Controlled beta acceptance is not enabled." },
      { status: 503 },
    );

  if (!config().auth || !config().database)
    return NextResponse.json(
      {
        error:
          "Account service is pending configuration. No account has been created.",
      },
      { status: 503 },
    );
  const payload = await boundedCommunityBody(request, 16000)
    .then((bytes) => JSON.parse(new TextDecoder().decode(bytes)))
    .catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          "Check the required fields. Passwords need at least 12 characters.",
      },
      { status: 400 },
    );
  const v = parsed.data;
  const invited = v.action === "signup" && !!v.invitationCode;
  const productionDenial = productionAuthRequestDenial(
    v.action,
    v.invitationCode,
  );
  if (productionDenial)
    return NextResponse.json(
      { error: productionDenial },
      { status: invited ? 403 : 503 },
    );
  if (
    !config().production &&
    ["signup", "recover", "resend"].includes(v.action) &&
    !invited &&
    !(await previewAuthEmailAllowed(v.email, v.app))
  )
    return NextResponse.json(
      {
        error:
          "Preview email requires a local authentication mail sink or verified, unexpired Docked Preview capture approval for this exact test recipient.",
      },
      { status: 503 },
    );
  if (
    !(await rateLimit(
      `auth:${hash(v.email ?? request.headers.get("x-forwarded-for") ?? "unknown")}`,
      6,
      300,
    ))
  )
    return NextResponse.json(
      { error: "Please wait before trying again." },
      { status: 429 },
    );
  if (invited) {
    try {
      return NextResponse.json(await redeemPreviewInvitation(v), {
        headers: { "Cache-Control": "private, no-store" },
      });
    } catch {
      return NextResponse.json(
        {
          error:
            "Preview invitation unavailable. Check the approved email, unused invitation code, username and required legal acceptances.",
        },
        { status: 403, headers: { "Cache-Control": "private, no-store" } },
      );
    }
  }
  const client = (await authClient())!;
  const sql = db();
  const destinationAfterAuth = async (
    user: {
      id: string;
      invited_at?: string;
      email_confirmed_at?: string;
      is_anonymous?: boolean;
      app_metadata?: Record<string, unknown>;
    } | null,
    fallback: string,
  ) => {
    if (
      productionInvitationsEnabled(process.env) &&
      verifiedInvitedUser(user) &&
      user
    ) {
      const profiles =
        await sql`select id from public.profiles where id=${user.id}`;
      if (!profiles.length) return "/app/invitation-setup";
    }
    return fallback;
  };
  if (v.action === "logout") {
    if (process.env.DOCKED_BETA_STAGING === "true") {
      try {
        await signOutBetaSession(client.auth);
        return NextResponse.json(
          { ok: true, redirect: v.app ? "/app/login" : "/" },
          { headers: { "Cache-Control": "no-store" } },
        );
      } catch {
        return NextResponse.json(
          { error: "Sign-out could not be confirmed. Please retry." },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
    }
    const { data: session } = await client.auth.getSession();
    const token = session.session?.access_token;
    const verified = token ? await client.auth.getUser(token) : null;
    // Revoke database-backed sessions first so an Auth-provider error cannot
    // leave copied JWTs usable against either the application or RLS.
    if (verified?.data.user && !verified.error)
      await sql`delete from ${sql.unsafe(authSessionsRelation())} where user_id=${verified.data.user.id}`;
    const { error } = await client.auth.signOut({ scope: "global" });
    if (error && !verified?.data.user)
      return NextResponse.json(
        { error: "Sign-out could not be confirmed. Please retry." },
        { status: 503 },
      );
    return NextResponse.json({
      ok: true,
      redirect: v.app ? "/app/login" : "/",
    });
  }
  if (["mfa_status", "mfa_enroll", "mfa_verify"].includes(v.action)) {
    const result = await mfaFlow(client.auth, v.action, v.code, v.next);
    return NextResponse.json(result, {
      status: "error" in result ? 400 : 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (v.action === "recover") {
    if (!v.email)
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    const { error } = await client.auth.resetPasswordForEmail(v.email, {
      redirectTo: `${config().siteUrl}/auth/callback?next=${v.app ? "/app/reset-password" : "/reset-password"}`,
    });
    if (error)
      return NextResponse.json(
        {
          error:
            "Recovery service is unavailable. No delivery has been confirmed.",
        },
        { status: 503 },
      );
    return NextResponse.json({
      ok: true,
      message: "If the account exists, recovery instructions will be sent.",
      ...(v.app ? { redirect: "/app/check-email?type=recovery" } : {}),
    });
  }
  if (v.action === "resend") {
    if (!v.email)
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    const { error } = await client.auth.resend({
      type: "signup",
      email: v.email,
      options: {
        emailRedirectTo: `${config().siteUrl}/auth/callback${v.app ? "?next=/app/verified" : ""}`,
      },
    });
    if (error)
      return NextResponse.json(
        {
          error:
            "Verification service is unavailable. No delivery has been confirmed.",
        },
        { status: 503 },
      );
    return NextResponse.json({
      ok: true,
      message: "If eligible, verification instructions will be sent.",
      ...(v.app ? { redirect: "/app/check-email?type=verification" } : {}),
    });
  }
  if (v.action === "reset") {
    if (!v.password)
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    const { data, error } = await client.auth.updateUser({
      password: v.password,
    });
    return NextResponse.json(
      error
        ? { error: passwordResetFailure(error) }
        : {
            ok: true,
            redirect: await destinationAfterAuth(
              data.user,
              v.app ? "/app/password-updated" : "/dashboard",
            ),
          },
    );
  }
  if (!v.email || !v.password)
    return NextResponse.json(
      { error: "Email and password required" },
      { status: 400 },
    );
  if (v.action === "login") {
    const { data, error } = await client.auth.signInWithPassword({
      email: v.email,
      password: v.password,
    });
    return NextResponse.json(
      error
        ? { error: "Sign-in failed. Check credentials and email verification." }
        : {
            ok: true,
            redirect: await destinationAfterAuth(data.user, "/app"),
          },
    );
  }
  const flags =
    await sql`select enabled from private.feature_flags where key='registration'`;
  if (!config().registration || !flags[0]?.enabled)
    return NextResponse.json(
      {
        error:
          "Registration is not open yet. Legal and service setup must be completed first.",
      },
      { status: 503 },
    );
  if (
    !v.country ||
    !v.state ||
    !explicitSignupConsent(v) ||
    (v.app && !v.username)
  )
    return NextResponse.json(
      {
        error:
          "Country/state, applicable legal-age attestation and terms/privacy acceptance are required.",
      },
      { status: 400 },
    );
  let versions;
  try {
    versions = currentConsentVersions();
  } catch {
    return NextResponse.json(
      { error: "Registration awaits approved Terms and Privacy documents." },
      { status: 503 },
    );
  }
  if (
    v.username &&
    (
      await sql`select 1 from private.social_handle_history where handle=${v.username}`
    ).length
  )
    return NextResponse.json(
      { error: "Username is unavailable. Choose another name." },
      { status: 409 },
    );
  // An existing Auth identity (including an unconfirmed one without an app profile)
  // must not gain attacker-supplied consent/preferences through another signup.
  const existingIdentity =
    (
      await sql`select 1 from ${sql.unsafe(authUsersRelation())} where lower(email)=lower(${v.email}) limit 1`
    ).length > 0;
  const { data, error } = await client.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      emailRedirectTo: `${config().siteUrl}/auth/callback${v.app ? "?next=/app/verified" : ""}`,
    },
  });
  if (error || !data.user)
    return NextResponse.json(
      { error: "Unable to create account. Try again later." },
      { status: 400 },
    );
  // Supabase may deliberately return an obfuscated existing user; never overwrite a profile or consents.
  if (existingIdentity || data.user.identities?.length === 0)
    return NextResponse.json({
      ok: true,
      message: "Check your email for account instructions.",
      ...(v.app ? { redirect: "/app/check-email?type=verification" } : {}),
    });
  let provisioned;
  try {
    provisioned = await sql.begin(async (tx) =>
      persistSignupProfile(
        signupTransaction(tx),
        data.user!.id,
        {
          country: v.country!,
          state: v.state!,
          username: v.username,
          marketing: v.marketing,
          digest: v.digest,
          education: v.education,
          analytics: v.analytics,
          edgeAlerts: v.edgeAlerts,
        },
        versions,
      ),
    );
  } catch {
    // Creation can have an uncertain outcome. Never delete an Auth identity to
    // compensate; an operator may reconcile it only after ownership is proven.
    try {
      await sql`insert into private.audit_events(actor,action,subject,details) values('account-service','signup_profile_repair_required',${data.user.id},'{"reason":"Application profile provisioning failed"}'::jsonb)`;
    } catch {
      /* Database failure remains visible in the response. */
    }
    return NextResponse.json(
      {
        error:
          "Account setup could not be completed. Do not resubmit repeatedly; contact support for account recovery.",
      },
      { status: 503 },
    );
  }
  if (provisioned.created)
    await recordAnalytics(data.user.id, "signup_completed", undefined, true);
  return NextResponse.json({
    ok: true,
    message:
      "Check your email to verify your account. Age self-attestation does not verify identity or regional eligibility.",
    ...(v.app ? { redirect: "/app/check-email?type=verification" } : {}),
  });
}
