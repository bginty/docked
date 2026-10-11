import { customerOnboardingEnabled } from "@/core/customer-onboarding.mjs";
import { NextResponse } from "next/server";
import { authClient, sameOrigin } from "@/server/auth";
import { db, rateLimit } from "@/server/db";
import { config } from "@/server/config";
import { boundedCommunityBody } from "@/core/community-social";
import { invitationSetup, verifiedInvitedUser } from "@/core/invitation-setup";
import { productionInvitationsEnabled } from "@/core/auth-invitation";
import {
  verifiedSessionClaims,
  conclusiveAuthFailure,
} from "@/core/auth-policy";
import { currentConsentVersions } from "@/core/auth-readiness";
import {
  persistInvitedProfile,
  type SignupTransaction,
} from "@/server/signup-profile";
import type { TransactionSql } from "postgres";
import { betaPolicyVersions } from "@/core/hosted-beta.mjs";

const headers = { "Cache-Control": "private, no-store" };
function transaction(tx: TransactionSql): SignupTransaction {
  return {
    query: async (sql, args) => [...(await tx.unsafe(sql, args))],
    savepoint: async (run) =>
      tx.savepoint(async (nested) => run(transaction(nested))),
  };
}
export async function POST(request: Request) {
  const fail = (status: number, error: string) =>
    NextResponse.json({ error }, { status, headers });
  if (!productionInvitationsEnabled(process.env))
    return fail(503, "Invited account setup is not available yet.");
  if (!sameOrigin(request)) return fail(403, "Origin denied");
  config(); // Enforce exact reviewed deployment identity before any Auth/DB access.
  try {
    const input = invitationSetup.safeParse(
      JSON.parse(
        new TextDecoder().decode(await boundedCommunityBody(request, 4096)),
      ),
    );
    if (!input.success)
      return fail(
        400,
        "Username, region, age attestation and separate Terms and Privacy acceptance are required.",
      );
    const versions = currentConsentVersions();
    const client = await authClient();
    if (!client) return fail(503, "Account service unavailable.");
    const { data: sessionData, error: sessionError } =
      await client.auth.getSession();
    const token = sessionData.session?.access_token;
    if (sessionError && !conclusiveAuthFailure(sessionError))
      return fail(503, "Authentication service is temporarily unavailable.");
    if (sessionError || !token)
      return fail(401, "Confirm your invitation and sign in first.");
    const {
      data: { user },
      error,
    } = await client.auth.getUser(token);
    if (error && !conclusiveAuthFailure(error))
      return fail(503, "Authentication service is temporarily unavailable.");
    const customer =
      !error &&
      user?.email_confirmed_at &&
      !user.is_anonymous &&
      customerOnboardingEnabled()
        ? (
            await db()`select private.customer_signup_identity(${user.id}::uuid) allowed`
          )[0]?.allowed === true
        : false;
    const renewal =
      !error && user?.email_confirmed_at && customerOnboardingEnabled()
        ? (
            await db()`select private.pending_beta_consent(${user.id}::uuid) allowed`
          )[0]?.allowed === true
        : false;
    if (error || !user || (!verifiedInvitedUser(user) && !customer && !renewal))
      return fail(401, "A verified invited account is required.");
    const claims = verifiedSessionClaims(token, user.id);
    if (!claims) return fail(401, "Session unavailable. Sign in again.");
    if (
      renewal &&
      claims.aal !== "aal2" &&
      (
        await db()`select private.gameplay_mfa_required(${user.id}::uuid) required`
      )[0]?.required
    )
      return NextResponse.json({ ok: true, redirect: "/mfa" }, { headers });
    if (!(await rateLimit(`invitation-setup:${user.id}`, 6, 300)))
      return fail(429, "Please wait before trying again.");
    const sql = db();
    await sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub',${user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: user.id, session_id: claims.sessionId, aal: claims.aal })},true)`;
      if (process.env.DOCKED_BETA_STAGING === "true") {
        const policyVersions = betaPolicyVersions();
        if (
          (!customer && !renewal && !input.data.betaAdmissionCode) ||
          input.data.betaRules !== true ||
          !policyVersions
        )
          throw Error(
            "Explicit beta invitation and policy acceptance required",
          );
        if (renewal) {
          await tx`select private.renew_customer_consent(${user.id}::uuid,${claims.sessionId}::uuid,${input.data.country},${input.data.state},${tx.json(policyVersions)}::jsonb)`;
        } else if (customer)
          await tx`select private.accept_customer_admission(${user.id}::uuid,${claims.sessionId}::uuid,${input.data.country},${input.data.state},${input.data.age},${tx.json(policyVersions)}::jsonb)`;
        else
          await tx`select private.accept_admission(${input.data.betaAdmissionCode!},${user.id}::uuid,${claims.sessionId}::uuid,${input.data.country},${input.data.state},${input.data.age},${tx.json(policyVersions)}::jsonb)`;
      }
      await persistInvitedProfile(
        transaction(tx),
        user.id,
        claims.sessionId,
        input.data,
        versions,
      );
      if (customer) {
        // This explicit final form is the entire required onboarding step.
        // Optional sport/notification preferences can be changed later.
        await tx`insert into private.app_onboarding(user_id,interests) values(${user.id},'both') on conflict do nothing`;
        await tx`update public.profiles set sports=array['nfl'],timezone='Australia/Sydney',onboarding_completed_at=coalesce(onboarding_completed_at,clock_timestamp()) where id=${user.id}`;
      }
    });
    return NextResponse.json(
      { ok: true, redirect: customer ? "/fantasy/cards" : "/app" },
      { headers },
    );
  } catch {
    // No compensating Auth deletion. Existing profiles/consent are never overwritten.
    return fail(
      503,
      "Account setup could not be confirmed. Retry while signed in or contact support. No additional invitation is needed.",
    );
  }
}
