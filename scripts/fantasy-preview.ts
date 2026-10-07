// Exact isolated Preview operator. Secrets stay in ignored private-data, never stdout.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import postgres from "postgres";
import {
  assertPhase5dConnection,
  phase5dProject,
} from "./hosted-preview/phase5d-scope";
const output = "docs/qa/fantasy";
const privateRoot = "private-data/fantasy";
const migration = "20261007204317_fantasy_cards_preview_v1.sql";
async function main() {
  const mode = process.argv[2];
  if (
    !["inspect", "dry-run", "apply", "verify"].includes(mode) ||
    process.argv[3] !== `--confirm-project=${phase5dProject}`
  )
    throw Error("Exact mode and Preview project required");
  const c = JSON.parse(
    await readFile("private-data/hosted-preview/connection.json", "utf8"),
  );
  assertPhase5dConnection(c);
  const sql = postgres(c.databaseUrl, {
    max: 1,
    prepare: false,
    ssl: { rejectUnauthorized: true, ca: await readFile(c.caFile, "utf8") },
    onnotice: () => {},
  });
  await mkdir(output, { recursive: true });
  await mkdir(privateRoot, { recursive: true });
  try {
    const files = (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    if (files.at(-1) !== migration || files.length !== 19)
      throw Error("Reviewed migration sequence required");
    const history =
      await sql`select version from supabase_migrations.schema_migrations order by version`;
    if (
      (history.length !== 18 && history.length !== 19) ||
      history.some((r, i) => r.version !== files[i].split("_")[0])
    )
      throw Error("Migration history mismatch");
    const baseline = (
      await sql`select (select count(*) from auth.users)::int users,(select count(*) from private.tip_publications)::int publications,(select count(*) from private.feature_flags where enabled)::int enabled_flags,(select count(*) from private.outbox where state='sent')::int sent,(select count(*) from private.football_model_attempts)::int model_attempts`
    )[0];
    const hash = createHash("sha256")
      .update(await readFile("supabase/migrations/" + migration))
      .digest("hex");
    if (mode === "inspect") {
      await writeFile(
        privateRoot + "/baseline.json",
        JSON.stringify({
          history,
          baseline,
          migrationHash: hash,
          at: new Date().toISOString(),
        }),
        { flag: "wx", mode: 0o600 },
      );
      await writeFile(
        output + "/baseline.json",
        JSON.stringify(
          {
            project: phase5dProject,
            baseline,
            migrations: history.length,
            migrationHash: hash,
            productionChanged: false,
          },
          null,
          2,
        ),
      );
      console.log(
        JSON.stringify({
          project: phase5dProject,
          baseline,
          migrations: history.length,
        }),
      );
      return;
    }
    if (mode === "dry-run" || mode === "apply") {
      if (history.length !== 18)
        throw Error("Migration already applied or unexpected baseline");
      const base = JSON.parse(
        await readFile(privateRoot + "/baseline.json", "utf8"),
      );
      if (JSON.stringify(base.baseline) !== JSON.stringify(baseline))
        throw Error("Protected baseline changed");
      if (mode === "apply") {
        const dry = JSON.parse(
          await readFile(output + "/migration-dry-run.json", "utf8"),
        );
        if (dry.hash !== hash || dry.status !== "PASS")
          throw Error("Exact reviewed dry run required");
      }
      const out = execFileSync(
        process.execPath,
        [
          "node_modules/supabase/dist/supabase.js",
          "db",
          "push",
          "--db-url",
          c.databaseUrl,
          "--skip-vault",
          "--yes",
          ...(mode === "dry-run" ? ["--dry-run"] : []),
        ],
        {
          env: { ...process.env, NODE_EXTRA_CA_CERTS: c.caFile },
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
          timeout: 120000,
        },
      );
      await writeFile(privateRoot + "/migration-" + mode + ".log", out, {
        mode: 0o600,
      });
      await writeFile(
        output + "/migration-" + mode + ".json",
        JSON.stringify(
          {
            status: "PASS",
            hash,
            project: phase5dProject,
            productionChanged: false,
            at: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
      console.log("Preview migration " + mode + " passed.");
    } else {
      const acl =
        await sql`select c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') anon_access,has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') member_access from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='fantasy' and c.relkind='r'`;
      if (
        !acl.length ||
        acl.some((t) => !t.relrowsecurity || t.anon_access || t.member_access)
      )
        throw Error("Fantasy ACL failure");
      await writeFile(
        output + "/migration-verified.json",
        JSON.stringify(
          {
            status: "PASS",
            hash,
            project: phase5dProject,
            migrations: history.length,
            acl,
            baseline,
            productionChanged: false,
          },
          null,
          2,
        ),
      );
      console.log("Preview migration and fantasy RLS verified.");
    }
  } finally {
    await sql.end();
  }
}
main().catch(async (e) => {
  await mkdir(privateRoot, { recursive: true });
  await writeFile(privateRoot + "/operator-error.txt", String(e?.stack ?? e), {
    mode: 0o600,
  });
  console.error(
    "Preview operation failed; diagnostic retained in private-data/fantasy/operator-error.txt.",
  );
  process.exitCode = 1;
});
