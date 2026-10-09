// Exact-target operator entry point: real GoTrue sessions, real MFA, rollback-only sporting fixtures.
import { readFile, writeFile } from "node:fs/promises";
import { createHmac } from "node:crypto";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { db } from "../../src/server/db";
import { verifiedSessionClaims } from "../../src/core/auth-policy";
import { runMarketReferenceRollback } from "./market-reference-rollback";
const project = "bckkllmndoxzpzdqrevb";
const directory = pathToFileURL(resolve("private-data/hosted-preview") + sep);
const read = async (name: string) =>
  JSON.parse(await readFile(new URL(name, directory), "utf8"));
const signouts: (() => Promise<unknown>)[] = [];
let sql: ReturnType<typeof db> | undefined;
function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.toUpperCase().replace(/=+$/, "")]
    .map((c) => {
      const n = alphabet.indexOf(c);
      if (n < 0) throw Error("MFA seed shape");
      return n.toString(2).padStart(5, "0");
    })
    .join("");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", Buffer.from(bytes))
    .update(counter)
    .digest();
  return ((digest.readUInt32BE(digest[19] & 15) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
async function main() {
  try {
    const connection = await read("connection.json"),
      fixture = await read("acceptance.json"),
      state = await read("state.json"),
      mfa = await read("mfa.json");
    if (
      process.argv[2] !== "--run-real-clock-rollback" ||
      connection.projectRef !== project ||
      connection.organizationId !== "ernfnkcbalhyqpsrzdwa" ||
      fixture.projectRef !== project ||
      process.env.APP_ENV !== "preview" ||
      process.env.SUPABASE_ENV !== "preview" ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !==
        `https://${project}.supabase.co` ||
      process.env.DATABASE_URL !== connection.databaseUrl ||
      process.env.SENDING_ENABLED === "true" ||
      process.env.PUBLICATION_ENABLED === "true" ||
      process.env.FORWARD_PAPER_ENABLED === "true"
    )
      throw Error("Exact rollback scope denied");
    sql = db();
    async function actor(label: "memberA" | "memberB" | "admin") {
      const account = fixture.accounts[label];
      if (!/^docked-preview-[a-z0-9-]+@example[.]invalid$/.test(account.email))
        throw Error("Reserved identity required");
      const client = createClient(
        connection.supabaseUrl,
        connection.publishableKey,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      signouts.push(() => client.auth.signOut({ scope: "local" }));
      const { data, error } = await client.auth.signInWithPassword({
        email: account.email,
        password:
          state.accounts[label]?.passwordVersion === "recovered"
            ? account.recoveryPassword
            : account.password,
      });
      if (error || !data.session || data.user.id !== state.accounts[label]?.id)
        throw Error("Real QA login required");
      if (label === "admin") {
        const factor = mfa.admin;
        if (!factor?.factorId || !factor?.secret)
          throw Error("Existing genuine MFA enrolment required");
        const result = await client.auth.mfa.challengeAndVerify({
          factorId: factor.factorId,
          code: totp(factor.secret),
        });
        if (result.error)
          throw Error("Actual administrator MFA verification failed");
      }
      const session = (await client.auth.getSession()).data.session;
      if (!session) throw Error("Actual session missing");
      const verified = await client.auth.getUser(session.access_token);
      const claims = verifiedSessionClaims(session.access_token, data.user.id);
      if (
        verified.error ||
        verified.data.user?.id !== data.user.id ||
        !claims ||
        (label === "admin" && claims.aal !== "aal2")
      )
        throw Error("Verified Auth claims required");
      return {
        userId: data.user.id,
        sessionId: claims.sessionId,
        aal: claims.aal as "aal1" | "aal2",
      };
    }
    const member = await actor("memberA"),
      other = await actor("memberB"),
      admin = await actor("admin");
    const counts = async () => {
      const [row] = await sql!`select
      (select count(*)::int from private.events) events,
      (select count(*)::int from private.odds_snapshots) odds_snapshots,
      (select count(*)::int from private.market_references) market_references,
      (select count(*)::int from private.community_edges) community_edges,
      (select count(*)::int from private.community_settlements) community_settlements,
      (select count(*)::int from private.tip_publications) official_publications`;
      return row;
    };
    const before = await counts();
    const result = await runMarketReferenceRollback(
      sql,
      { member, other, admin },
      {
        waitForSettlement: true,
        progress: (stage) => console.log(`Rollback fixture: ${stage}`),
      },
    );
    const after = await counts();
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw Error("Fixture rollback count mismatch");
    await writeFile(
      resolve("docs/qa/phase4/market-reference-hosted-rollback.json"),
      JSON.stringify(
        {
          projectRef: project,
          recordedAt: new Date().toISOString(),
          fixtureMode: "ROLLBACK_ONLY_FICTIONAL",
          genuineAuth: true,
          genuineAdministratorMfa: true,
          ...result,
          before,
          after,
          evidenceLimit:
            "Database constraints and deterministic accounting only; no sporting research or performance evidence.",
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `Hosted rollback acceptance: ${result.checks.length} checks passed; sporting counts unchanged.`,
    );
  } catch (error) {
    await writeFile(
      new URL("last-rollback-error.json", directory),
      JSON.stringify({
        message: error instanceof Error ? error.message : "Unknown",
        code: (error as { code?: string }).code,
      }),
      { mode: 0o600 },
    );
    console.error(
      "Hosted rollback fixture failed; inspect private diagnostics. No credentials printed.",
    );
    process.exitCode = 1;
  } finally {
    for (const signout of signouts) {
      try {
        await signout();
      } catch {
        console.error(
          "QA session signout unavailable; teardown must erase the reserved roster.",
        );
      }
    }
    if (sql) await sql.end({ timeout: 5 });
  }
}
void main();
