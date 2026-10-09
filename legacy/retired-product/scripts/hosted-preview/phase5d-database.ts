// Exact isolated Preview only. No seed, role, Vault, provider or production operation.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import postgres from "postgres";
import { assertPhase5dConnection, phase5dProject } from "./phase5d-scope";

const root = "docs/qa/phase5d",
  privateRoot = "private-data/phase5d";
const migrationName = "20261004044506_phase5d_fitted_poisson_research.sql";
const sha = (v: string | Uint8Array) =>
  createHash("sha256").update(v).digest("hex");
async function main() {
  const mode = process.argv[2];
  let sql: ReturnType<typeof postgres> | undefined;
  try {
    if (
      !["snapshot", "dry-run", "apply", "verify"].includes(mode) ||
      process.argv[3] !== `--confirm-project=${phase5dProject}` ||
      process.argv.length !== 4
    )
      throw Error("Exact mode/project required");
    await mkdir(root, { recursive: true });
    await mkdir(privateRoot, { recursive: true });
    const c = JSON.parse(
      await readFile("private-data/hosted-preview/connection.json", "utf8"),
    );
    assertPhase5dConnection(c);
    const u = new URL(c.databaseUrl);
    sql = postgres(c.databaseUrl, {
      host: u.hostname,
      port: 5432,
      max: 1,
      prepare: false,
      ssl: { rejectUnauthorized: true, ca: await readFile(c.caFile, "utf8") },
      onnotice: () => {},
    });
    const local = (await readdir("supabase/migrations"))
      .filter((f) => /^\d+_.+\.sql$/.test(f))
      .sort();
    if (local.length !== 18 || local.at(-1) !== migrationName)
      throw Error("Reviewed 18-file migration order required");
    const migrations =
      await sql`select version from supabase_migrations.schema_migrations order by version`;
    const expectedCount = mode === "verify" ? 18 : 17;
    if (
      migrations.length !== expectedCount ||
      migrations.some((r, i) => r.version !== local[i].split("_")[0])
    )
      throw Error("Remote migration preimage/order mismatch");
    const [guard] =
      await sql`select (select count(*)::int from auth.users) users,(select count(*)::int from private.tip_publications) publications,(select count(*)::int from private.feature_flags where enabled) enabled,(select count(*)::int from private.outbox where state='sent') sends,(select count(*)::int from private.football_model_attempts) attempts,(select count(*)::int from private.football_model_versions) model_versions`;
    if (
      guard.users !== 4 ||
      Object.entries(guard).some(
        ([key, value]) => key !== "users" && value !== 0,
      )
    )
      throw Error("Preserved closed baseline mismatch");
    const migrationHash = sha(
      await readFile("supabase/migrations/" + migrationName),
    );
    const env = {
      ...process.env,
      APP_ENV: "preview",
      SUPABASE_ENV: "preview",
      DATABASE_URL: c.databaseUrl,
      DATABASE_SSL_CA_FILE: c.caFile,
      NEXT_PUBLIC_SUPABASE_URL: c.supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: c.publishableKey,
      SENDING_ENABLED: "false",
      PUBLICATION_ENABLED: "false",
      FORWARD_PAPER_ENABLED: "false",
      AUTO_PUBLISH_DOCKED_EDGES: "false",
      RESEARCH_AUTOMATION_ENABLED: "false",
    };
    if (mode === "snapshot") {
      execFileSync(
        process.execPath,
        [
          "--conditions=react-server",
          "--import",
          "tsx",
          "scripts/hosted-preview/snapshot-before-migration.ts",
          "--snapshot-phase5d",
        ],
        { env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
      );
      await writeFile(
        root + "/migration-review.json",
        JSON.stringify(
          {
            projectRef: phase5dProject,
            migrationName,
            migrationHash,
            local,
            guard,
            capturedAt: new Date().toISOString(),
          },
          null,
          2,
        ) + "\n",
        { flag: "wx" },
      );
      console.log(
        "Protected application preimage and reviewed migration hash captured.",
      );
    } else if (mode === "dry-run" || mode === "apply") {
      const pre = JSON.parse(
        await readFile(root + "/migration-preimage.json", "utf8"),
      );
      const review = JSON.parse(
        await readFile(root + "/migration-review.json", "utf8"),
      );
      if (
        pre.projectRef !== phase5dProject ||
        pre.migrationCount !== 17 ||
        review.migrationHash !== migrationHash ||
        JSON.stringify(review.local) !== JSON.stringify(local)
      )
        throw Error("Protected preimage/review changed");
      if (mode === "apply") {
        const dry = JSON.parse(
          await readFile(root + "/migration-dry-run.json", "utf8"),
        );
        if (dry.migrationHash !== migrationHash || dry.status !== "PASS")
          throw Error("Matching dry run required");
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
          env: { ...env, NODE_EXTRA_CA_CERTS: c.caFile },
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
          timeout: 120000,
        },
      );
      await writeFile(privateRoot + "/migration-" + mode + ".txt", out, {
        mode: 0o600,
      });
      await writeFile(
        root + "/migration-" + mode + ".json",
        JSON.stringify(
          {
            status: "PASS",
            projectRef: phase5dProject,
            migrationHash,
            mode,
            recordedAt: new Date().toISOString(),
            productionChanged: false,
          },
          null,
          2,
        ) + "\n",
        { flag: "wx" },
      );
      console.log(`Exact Docked Preview migration ${mode} completed.`);
    } else {
      const tables =
        await sql`select c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') anon_access,has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') member_access from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r' and c.relname='football_training_manifests' order by c.relname`;
      if (
        tables.length !== 1 ||
        tables.some(
          (t) => !t.relrowsecurity || t.anon_access || t.member_access,
        )
      )
        throw Error("Research RLS/ACL mismatch");
      const [counts] =
        await sql`select (select count(*)::int from private.research_source_versions) sources,(select count(*)::int from private.research_facts) facts,(select count(*)::int from private.research_dataset_snapshots) datasets,(select count(*)::int from private.research_content) content,(select count(*)::int from private.research_recalculations) recalculations`;
      if (Object.values(counts).some((v) => v !== 0))
        throw Error("Research unexpectedly seeded");
      await writeFile(
        root + "/hosted-migration.json",
        JSON.stringify(
          {
            status: "PASS",
            projectRef: phase5dProject,
            recordedAt: new Date().toISOString(),
            migrations: migrations.map((m) => m.version),
            migrationHash,
            tables,
            guard,
            counts,
            productionChanged: false,
          },
          null,
          2,
        ) + "\n",
        { flag: "wx" },
      );
      console.log(
        "18 ordered migrations; fitted training table has RLS and no browser grants. Sources/data remain unseeded.",
      );
    }
  } catch (error: unknown) {
    const e = error as Error & { stderr?: Buffer };
    await mkdir(privateRoot, { recursive: true });
    await writeFile(
      privateRoot + "/database-error.json",
      JSON.stringify({
        mode,
        message: e.message,
        stderr: e.stderr?.toString() ?? null,
      }),
      { mode: 0o600 },
    );
    console.error(
      "Phase5D database operation failed; sensitive diagnostic retained privately.",
    );
    process.exitCode = 1;
  } finally {
    await sql?.end({ timeout: 5 });
  }
}
void main();
