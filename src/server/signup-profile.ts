import type { ConsentVersions } from "../core/auth-readiness";
import { signupHandleCollision } from "../core/auth-readiness";

export type SignupTransaction = {
  query: (
    text: string,
    parameters: (string | boolean)[],
  ) => Promise<Record<string, unknown>[]>;
  savepoint: (
    run: (transaction: SignupTransaction) => Promise<void>,
  ) => Promise<void>;
};
export type SignupProfileInput = {
  country: string;
  state: string;
  username?: string;
  marketing?: boolean;
  digest?: boolean;
  education?: boolean;
  analytics?: boolean;
  edgeAlerts?: boolean;
};

/** Production only. Caller must first verify the exact Auth token with getUser,
 * including its authoritative invited_at, and obtain explicit current consent.
 * No direct managed Auth-table permissions or privileged role are required. */
export async function persistInvitedProfile(
  tx: SignupTransaction,
  userId: string,
  sessionId: string,
  input: SignupProfileInput,
  versions: ConsentVersions,
) {
  await tx.query("select pg_advisory_xact_lock(hashtextextended($1,761))", [
    userId,
  ]);
  const active = () =>
    tx.query(
      "select s.id from private.runtime_auth_sessions s join private.runtime_auth_users u on u.id=s.user_id where s.id=$1 and s.user_id=$2 and (s.not_after is null or s.not_after>clock_timestamp()) and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=clock_timestamp())",
      [sessionId, userId],
    );
  if (!(await active()).length) throw Error("Invited session inactive");
  const existing = await tx.query(
    "select disabled_at from public.profiles where id=$1",
    [userId],
  );
  if (existing[0]?.disabled_at) throw Error("Account unavailable");
  const result = await persistSignupProfile(tx, userId, input, versions);
  if (!(await active()).length) throw Error("Invited session inactive");
  return result;
}

/** Called in one server transaction only after Auth's signup response is checked.
 * A competing handle reservation must not roll back the new account's legal record.
 * Existing accounts are never changed by retrying signup.
 */
export async function persistSignupProfile(
  tx: SignupTransaction,
  userId: string,
  input: SignupProfileInput,
  versions: ConsentVersions,
) {
  const inserted = await tx.query(
    "insert into public.profiles(id,country,state,age_attested,accepted_version) values($1,$2,$3,true,$4) on conflict do nothing returning id",
    [userId, input.country, input.state, versions.terms],
  );
  if (!inserted.length) return { created: false, usernameRequired: false };
  await tx.query(
    "insert into public.notification_preferences(user_id,digest,education,edge_alerts) values($1,$2,$3,$4) on conflict do nothing",
    [userId, input.digest ? "weekly" : "off", !!input.education, false],
  );
  for (const [purpose, granted] of Object.entries({
    terms: true,
    privacy: true,
    age_attestation: true,
    marketing: !!input.marketing,
    digest: !!input.digest,
    education: !!input.education,
    edge: false,
    analytics: !!input.analytics,
  }))
    await tx.query(
      "insert into private.consent_events(user_id,purpose,granted,version,actor) values($1::uuid,$2,$3,$4,($1::uuid)::text)",
      [
        userId,
        purpose,
        granted,
        ["terms", "age_attestation"].includes(purpose)
          ? versions.terms
          : versions.privacy,
      ],
    );
  let usernameRequired = !input.username;
  if (input.username) {
    try {
      await tx.savepoint(async (savepoint) => {
        await savepoint.query(
          "insert into private.social_profiles(user_id,handle,display_name) values($1,$2,$2)",
          [userId, input.username!],
        );
      });
    } catch (error) {
      if (!signupHandleCollision(error)) throw error;
      usernameRequired = true;
    }
  }
  return { created: true, usernameRequired };
}
