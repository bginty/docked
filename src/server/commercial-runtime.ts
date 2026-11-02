import "server-only";
import postgres from "postgres";
import { db } from "./db";
import { authUsersRelation } from "../core/auth-relations";
import { databaseConnectionOptions } from "./database-tls";
import { databasePoolOptions } from "./database-pool";
import { CommercialLedger } from "./commercial-ledger";
import { GoogleCommercialVerifier } from "./google-commercial-verifier";
import { CommercialReconciliation } from "./commercial-reconciliation";
import { googlePlayOAuth } from "./google-play-oauth";
import { isolatedBillingConfiguration } from "../core/isolated-billing-acceptance";
let connection: ReturnType<typeof postgres> | undefined;
/** Commercial always rejects TEST. A separately bound existing Preview may use
 * the acceptance ledger, which itself rejects every real Google receipt. */
export async function commercialRuntime() {
  if (process.env.DOCKED_COMMERCIAL_SERVICE !== "true")
    throw Error("Commercial service disabled");
  const url = process.env.DOCKED_COMMERCIAL_DATABASE_URL ?? "";
  const acceptance = isolatedBillingConfiguration(process.env);
  const active = process.env.DOCKED_COMMERCIAL_REFERENCE_KEY_ID ?? "v1";
  const configured: unknown = process.env.DOCKED_COMMERCIAL_REFERENCE_KEYS
    ? JSON.parse(process.env.DOCKED_COMMERCIAL_REFERENCE_KEYS)
    : { v1: process.env.DOCKED_COMMERCIAL_REFERENCE_KEY ?? "" };
  if (
    !configured ||
    typeof configured !== "object" ||
    Array.isArray(configured)
  )
    throw Error("Commercial key unavailable");
  const values: Record<string, Buffer> = {};
  for (const [id, key] of Object.entries(configured)) {
    if (
      !/^[a-zA-Z0-9_-]{1,32}$/.test(id) ||
      typeof key !== "string" ||
      !/^[a-f0-9]{64}$/.test(key)
    )
      throw Error("Commercial key unavailable");
    values[id] = Buffer.from(key, "hex");
  }
  if (!values[active]) throw Error("Commercial key unavailable");
  if (!connection)
    connection = postgres(url, {
      ...databaseConnectionOptions(url),
      ...(process.env.DATABASE_RUNTIME === "serverless"
        ? databasePoolOptions()
        : { max: 3, prepare: false }),
    });
  const [role] =
    await connection`select current_user name,r.rolsuper,r.rolbypassrls,pg_has_role(current_user,'docked_commercial_app','member') permitted from pg_roles r where r.rolname=current_user`;
  if (!role?.permitted || role.rolsuper || role.rolbypassrls)
    throw Error("Restricted commercial database role required");
  const environment = acceptance ? "acceptance" : "commercial";
  const [control] =
    await connection`select environment from commercial_billing.control where id`;
  if (control?.environment !== environment)
    throw Error("Runtime and ledger environment mismatch");
  const ledger = new CommercialLedger(connection, environment, {
    active,
    values,
  });
  // Read-only wallets/collections must remain available during a verifier
  // credential outage. Verification still fails closed before any receipt is
  // accepted; no read projection needs to request a Google access token.
  let oauth: ReturnType<typeof googlePlayOAuth> | undefined;
  const verifier = new GoogleCommercialVerifier(environment, () => {
    oauth ??= googlePlayOAuth(
      (acceptance
        ? process.env.DOCKED_ISOLATED_GOOGLE_SERVICE_EMAIL
        : process.env.DOCKED_GOOGLE_COMMERCIAL_SERVICE_EMAIL) ?? "",
      (acceptance
        ? process.env.DOCKED_ISOLATED_GOOGLE_PRIVATE_KEY
        : process.env.DOCKED_GOOGLE_COMMERCIAL_PRIVATE_KEY) ?? "",
    );
    return oauth();
  });
  return {
    ledger,
    verifier,
    worker: new CommercialReconciliation(ledger, verifier, async (member) => {
      const sql = db();
      const [r] =
        await sql`select exists(select 1 from public.profiles p join ${sql.unsafe(authUsersRelation())} u on u.id=p.id where p.id=${member} and p.disabled_at is null and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=clock_timestamp())) active`;
      return r.active === true;
    }),
  };
}
