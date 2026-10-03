import { NextResponse } from "next/server";
import { z } from "zod";
import { authClient, sameOrigin } from "@/server/auth";
import { config } from "@/server/config";
import { db, rateLimit } from "@/server/db";
import { hash } from "@/core/pricing";
import { recordAnalytics } from "@/server/analytics";
import { previewAuthEmailAllowed } from "@/server/preview-auth";
import { boundedCommunityBody } from "@/core/community-social";
import { signupUsername } from "@/core/preview-testers";
import { redeemPreviewInvitation } from "@/server/preview-invitations";
const schema = z.object({
  action: z.enum([
    "signup",
    "login",
    "recover",
    "resend",
    "reset",
    "logout",
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
  edgeAlerts: z.boolean().optional(),
  factorId: z.string().uuid().optional(),
  code: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Origin denied" }, { status: 403 });
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
  if (v.action === "logout") {
    const { data: session } = await client.auth.getSession();
    const token = session.session?.access_token;
    const verified = token ? await client.auth.getUser(token) : null;
    // Revoke database-backed sessions first so an Auth-provider error cannot
    // leave copied JWTs usable against either the application or RLS.
    if (verified?.data.user && !verified.error)
      await sql`delete from auth.sessions where user_id=${verified.data.user.id}`;
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
  if (v.action === "mfa_enroll") {
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Sign in first" }, { status: 401 });
    const { data, error } = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Docked privileged access",
    });
    return NextResponse.json(
      error
        ? { error: "MFA enrolment failed" }
        : {
            factorId: data?.id,
            secret: data?.totp.secret,
            uri: data?.totp.uri,
          },
    );
  }
  if (v.action === "mfa_verify") {
    if (!v.factorId || !v.code)
      return NextResponse.json(
        { error: "Factor and code required" },
        { status: 400 },
      );
    const { error } = await client.auth.mfa.challengeAndVerify({
      factorId: v.factorId,
      code: v.code,
    });
    return NextResponse.json(
      error
        ? { error: "Invalid verification code" }
        : { ok: true, redirect: "/admin" },
    );
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
    const { error } = await client.auth.updateUser({ password: v.password });
    return NextResponse.json(
      error
        ? { error: "Recovery session invalid or expired" }
        : {
            ok: true,
            redirect: v.app ? "/app/password-updated" : "/dashboard",
          },
    );
  }
  if (!v.email || !v.password)
    return NextResponse.json(
      { error: "Email and password required" },
      { status: 400 },
    );
  if (v.action === "login") {
    const { error } = await client.auth.signInWithPassword({
      email: v.email,
      password: v.password,
    });
    return NextResponse.json(
      error
        ? { error: "Sign-in failed. Check credentials and email verification." }
        : { ok: true, redirect: v.app ? "/app" : "/dashboard" },
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
    !v.age ||
    !v.terms ||
    (v.app && (!v.privacy || !v.username))
  )
    return NextResponse.json(
      {
        error:
          "Country/state, applicable legal-age attestation and terms/privacy acceptance are required.",
      },
      { status: 400 },
    );
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
  if (data.user.identities?.length === 0)
    return NextResponse.json({
      ok: true,
      message: "Check your email for account instructions.",
    });
  const created = await sql.begin(async (tx) => {
    const inserted =
      await tx`insert into public.profiles(id,country,state,age_attested,accepted_version) values(${data.user!.id},${v.country!},${v.state!},true,'2026-10-draft') on conflict do nothing returning id`;
    if (!inserted.length) return false;
    await tx`insert into public.notification_preferences(user_id,digest,education,edge_alerts) values(${data.user!.id},${v.digest ? "weekly" : "off"},${!!v.education},${!!v.edgeAlerts}) on conflict do nothing`;
    for (const [purpose, granted] of Object.entries({
      terms: true,
      privacy: true,
      age_attestation: true,
      marketing: !!v.marketing,
      digest: !!v.digest,
      education: !!v.education,
      edge: !!v.edgeAlerts,
      analytics: !!v.analytics,
    }))
      await tx`insert into private.consent_events(user_id,purpose,granted,version,actor) values(${data.user!.id},${purpose},${granted},'2026-10-draft',${data.user!.id})`;
    if (v.app && v.username)
      await tx`insert into private.social_profiles(user_id,handle,display_name) values(${data.user!.id},${v.username},${v.username})`;
    return true;
  });
  if (created)
    await recordAnalytics(data.user.id, "signup_completed", undefined, true);
  return NextResponse.json({
    ok: true,
    message:
      "Check your email to verify your account. Age self-attestation does not verify identity or regional eligibility.",
    ...(v.app ? { redirect: "/app/check-email?type=verification" } : {}),
  });
}
