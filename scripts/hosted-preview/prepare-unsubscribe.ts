// Operator-only. Creates no Auth identity, delivery attempt or external email.
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import path from "node:path";
import postgres from "postgres";
import {
  dockedPreviewProjectRef,
  dockedPreviewOrigin,
  hostedPreviewEnvironmentBound,
  previewRecipient,
} from "../../src/core/preview-auth";
import { config } from "../../src/server/config";
import { leaseOutboxRecord } from "../../src/server/outbox-lease";
import { prepareOutboxUnsubscribe } from "../../src/server/unsubscribe-preparation";
import { databaseConnectionOptions } from "../../src/server/database-tls";
import type { Fixture, State } from "../../tests/hosted/guard";

const organizationId = "ernfnkcbalhyqpsrzdwa";
const root = pathToFileURL(path.resolve(process.cwd()) + path.sep);
const directory = new URL("private-data/hosted-preview/", root);
const fixturePath = new URL("acceptance.json", directory);
const read = async <T>(name: string): Promise<T> =>
  JSON.parse(await readFile(new URL(name, directory), "utf8")) as T;
async function main() {
  let sql: ReturnType<typeof postgres> | undefined;
  let phase = "local guards";
  try {
    if (
      process.argv[2] !== "--prepare-member-a" ||
      process.argv.length !== 3 ||
      process.env.DEBUG ||
      process.env.SENDING_ENABLED === "true" ||
      process.env.APP_ENV === "production"
    )
      throw new Error("explicit isolated operator invocation required");
    for (const url of [fixturePath, new URL("state.json", directory)])
      execFileSync(
        "git",
        ["check-ignore", "--quiet", "--", fileURLToPath(url)],
        {
          cwd: fileURLToPath(root),
          stdio: "ignore",
        },
      );
    const connection = await read<{
      projectRef: string;
      organizationId: string;
      supabaseUrl: string;
      databaseUrl: string;
    }>("connection.json");
    const fixture = await read<Fixture>("acceptance.json");
    const state = await read<State>("state.json");
    const env = parseEnv(await readFile(new URL(".env.local", root), "utf8"));
    const account = fixture.accounts?.memberA;
    const userId = state.accounts?.memberA?.id;
    if (
      connection.projectRef !== dockedPreviewProjectRef ||
      connection.organizationId !== organizationId ||
      connection.supabaseUrl !== dockedPreviewOrigin ||
      fixture.projectRef !== dockedPreviewProjectRef ||
      fixture.organizationId !== organizationId ||
      fixture.supabaseUrl !== dockedPreviewOrigin ||
      fixture.siteOrigin !== "http://localhost:3000" ||
      !/^[a-z0-9-]{6,24}$/.test(fixture.runId) ||
      !hostedPreviewEnvironmentBound(env) ||
      env.DATABASE_URL !== connection.databaseUrl ||
      env.SENDING_ENABLED !== "false" ||
      env.PUBLICATION_ENABLED !== "false" ||
      env.FORWARD_PAPER_ENABLED !== "false" ||
      env.ODDS_POLLING_ENABLED !== "false" ||
      config(env).sending ||
      !previewRecipient(account?.email) ||
      account?.unsubscribeToken ||
      !userId ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
        userId,
      ) ||
      (env.UNSUBSCRIBE_SECRET?.length ?? 0) < 32
    )
      throw new Error("identity, configuration or account guard failed");

    phase = "verified account and notification preparation";
    sql = postgres(connection.databaseUrl, {
      max: 1,
      prepare: false,
      ...databaseConnectionOptions(connection.databaseUrl, env),
      connect_timeout: 15,
    });
    const token = await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(6729381)`;
      const members =
        await tx`select p.id from public.profiles p join auth.users u on u.id=p.id join public.notification_preferences n on n.user_id=p.id join preview_auth.allowed_recipients a on a.email=u.email join preview_auth.configuration c on c.singleton where p.id=${userId} and u.email=${account.email} and u.email_confirmed_at is not null and p.onboarding_completed_at is not null and p.disabled_at is null and c.project_ref=${dockedPreviewProjectRef} and c.site_url='http://localhost:3000' and c.enabled and c.expires_at>clock_timestamp() and a.revoked_at is null and a.expires_at>clock_timestamp() for share of p,u,n,a,c`;
      if (members.length !== 1)
        throw new Error("real approved active member required");
      const id = randomUUID();
      // Existing enqueue producers use direct parameterised inserts. This is a labelled QA template only.
      await tx`insert into private.outbox(id,dedupe_key,kind,user_id,payload,available_at,expires_at) values(${id},${`hosted-preview-unsubscribe:${fixture.runId}:${id}`},'education',${userId},${tx.json({ subject: "QA ONLY — unsubscribe acceptance; never dispatch", text: "Isolated Docked Preview notification preparation for one-click unsubscribe acceptance. This notification must never be sent.", editorialApproval: "hosted-preview-qa-no-dispatch-v1" })},now(),now()+interval '10 minutes')`;
      const leased = await leaseOutboxRecord(tx, id);
      if (!leased || leased.id !== id || leased.user_id !== userId)
        throw new Error("exact QA notification lease required");
      const prepared = await prepareOutboxUnsubscribe(tx, {
        outboxId: id,
        userId,
        leaseToken: leased.lease_token,
        secret: env.UNSUBSCRIBE_SECRET!,
      });
      if (!prepared) throw new Error("notification preparation failed");
      const suppressed =
        await tx`update private.outbox set state='suppressed',last_error='QA unsubscribe preparation only; external delivery prohibited',lease_token=null,lease_until=null where id=${id} and state='leased' and lease_token=${leased.lease_token} returning id`;
      if (suppressed.length !== 1) throw new Error("QA suppression required");
      return prepared.token;
    });

    phase = "private acceptance token persistence";
    // Re-read to preserve independent acceptance progress; refuse changed identities or duplicate preparation.
    const current = await read<Fixture>("acceptance.json");
    const currentState = await read<State>("state.json");
    if (
      current.projectRef !== fixture.projectRef ||
      current.organizationId !== fixture.organizationId ||
      current.runId !== fixture.runId ||
      current.accounts.memberA.email !== account.email ||
      current.accounts.memberA.unsubscribeToken ||
      currentState.accounts.memberA?.id !== userId
    )
      throw new Error("acceptance identity changed during preparation");
    current.accounts.memberA.unsubscribeToken = token;
    await writeFile(fixturePath, JSON.stringify(current, null, 2) + "\n", {
      mode: 0o600,
    });
    console.log(
      "Prepared one genuine memberA unsubscribe capability privately; one QA notification leased then suppressed, zero dispatches.",
    );
  } catch {
    console.error(
      `Hosted preview unsubscribe stopped at ${phase}; no credentials or tokens printed.`,
    );
    process.exitCode = 1;
  } finally {
    await sql?.end({ timeout: 5 }).catch(() => undefined);
  }
}
void main();
