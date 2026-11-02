import { assertIsolatedPublicPreview } from "./isolated-public-preview.mjs";
type Env = Record<string, string | undefined>;
/** Exact temporary customer in the existing isolated Auth/database project.
 * No flag can switch the Production ledger into TEST mode. */
export function isolatedBillingConfiguration(env: Env, now = Date.now()) {
  if (env.DOCKED_ISOLATED_GOOGLE_TEST !== "true") return null;
  if (!assertIsolatedPublicPreview(env))
    throw Error("Isolated billing target required");
  const until = Date.parse(env.DOCKED_ISOLATED_GOOGLE_UNTIL ?? "");
  const member = env.DOCKED_ISOLATED_GOOGLE_MEMBER ?? "";
  const email = env.DOCKED_ISOLATED_GOOGLE_EMAIL ?? "";
  if (
    !Number.isFinite(until) ||
    until <= now ||
    until > now + 6 * 3600000 ||
    !/^[a-f0-9-]{36}$/.test(member) ||
    !/^docked-preview-public-member-[a-f0-9]+@example\.invalid$/.test(email) ||
    env.DOCKED_COMMERCIAL_CHECKOUT !== "false" ||
    !env.DOCKED_COMMERCIAL_DATABASE_URL?.includes(
      "docked_isolated_commercial.bckkllmndoxzpzdqrevb:",
    )
  )
    throw Error("Isolated billing admission unavailable");
  return { member, email, until };
}
export function isolatedBillingIdentity(
  env: Env,
  id: string,
  email: string | undefined,
  now = Date.now(),
) {
  const c = isolatedBillingConfiguration(env, now);
  return !!c && id === c.member && email === c.email;
}
