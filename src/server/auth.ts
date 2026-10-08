import { authSessionsRelation } from "@/core/auth-relations";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { db } from "./db";
import {
  verifiedSessionClaims,
  conclusiveAuthFailure,
} from "@/core/auth-policy";
import { authCookieOptions } from "@/core/auth-cookies";
import { assertDeploymentEnvironment } from "@/core/deployment-environment";
import { sameApplicationOrigin } from "./config";
export async function authClient() {
  assertDeploymentEnvironment(process.env);
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return null;
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) =>
              jar.set(name, value, authCookieOptions(options)),
            );
          } catch {
            /* Server component cannot refresh cookies; route handlers can. */
          }
        },
      },
    },
  );
}
export async function identity() {
  const c = await authClient();
  if (!c) return null;
  const { data: session, error: sessionError } = await c.auth.getSession();
  if (sessionError) {
    if (conclusiveAuthFailure(sessionError)) return null;
    throw new Error("Authentication service temporarily unavailable");
  }
  const token = session.session?.access_token;
  if (!token) return null;
  const {
    data: { user },
    error,
  } = await c.auth.getUser(token);
  if (error) {
    if (conclusiveAuthFailure(error)) return null;
    throw new Error("Authentication service temporarily unavailable");
  }
  if (!user || !user.email_confirmed_at || user.is_anonymous) return null;
  const sql = db();
  if (process.env.DOCKED_BETA_STAGING === 'true') {
    if (process.env.BETA_ACCESS_ENABLED !== 'true') return null;
    const admission = await sql`select private.admitted(${user.id}::uuid) allowed`;
    if (!admission[0]?.allowed) return null;
  }
  const p =
    await sql`select * from public.profiles where id=${user.id} and disabled_at is null`;
  if (!p.length) return null;
  const claims = verifiedSessionClaims(token, user.id);
  if (!claims) return null;
  const active =
    await sql`select id from ${sql.unsafe(authSessionsRelation())} where id=${claims.sessionId} and user_id=${user.id} and (not_after is null or not_after>now())`;
  if (!active.length) return null;
  return {
    user,
    profile: p[0],
    aal: claims.aal as string,
    sessionId: claims.sessionId,
  };
}
export async function requireIdentity() {
  const who = await identity();
  if (!who) throw new Error("Authentication required");
  return who;
}
export async function requireRole(roles: string[]) {
  const who = await requireIdentity();
  if (who.aal !== "aal2") throw new Error("Privileged MFA required");
  const sql = db();
  const rows =
    await sql`select role from private.roles where user_id=${who.user.id}`;
  if (!rows[0] || !roles.includes(rows[0].role)) throw new Error("Role denied");
  return { ...who, role: rows[0].role as string };
}
export function sameOrigin(request: Request) {
  return sameApplicationOrigin(request.headers.get("origin"));
}
