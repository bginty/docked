import "server-only";
import { authClient } from "./auth";
import { db } from "./db";
import { verifiedSessionClaims } from "../core/auth-policy";
import {
  namedTesterNoticeVersion,
  type NamedTesterSetup,
} from "../core/named-private-tester";

/** Presentation only. The POST and database independently recheck authorization. */
export async function namedPrivateTesterSetup(): Promise<NamedTesterSetup | null> {
  if (
    process.env.DOCKED_BETA_STAGING !== "true" ||
    process.env.DOCKED_FRIENDS_BETA !== "true"
  )
    return null;
  const client = await authClient();
  if (!client) return null;
  const { data: session, error: sessionError } = await client.auth.getSession();
  const token = session.session?.access_token;
  if (sessionError || !token) return null;
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  if (error || !user || user.is_anonymous || !user.email_confirmed_at)
    return null;
  if (!verifiedSessionClaims(token, user.id)) return null;
  const [row] =
    await db()`select private.named_tester_setup_identity(${user.id}::uuid) allowed`;
  return row?.allowed === true
    ? { country: "US", state: "CA", version: namedTesterNoticeVersion }
    : null;
}
