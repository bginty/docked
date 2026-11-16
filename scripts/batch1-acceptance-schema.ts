/** Schema definitions only from the existing authenticated archive. No rows/hosted writes. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createDecipheriv } from "node:crypto";
import { spawn } from "node:child_process";
const privateDir = "private-data/batch1-hosted-20261116";
const dir = "docs/qa/batch1-hosted-20261116";
async function main() {
  mkdirSync(privateDir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  const key = Buffer.from(
    readFileSync(
      process.env.USERPROFILE +
        "/.docked-secrets/launch-migration-backup-key.hex",
      "utf8",
    ).trim(),
    "hex",
  );
  try {
    const base = "private-data/commercial-restore-20261116b/";
    const m = readFileSync(base + "manifest.aes"),
      md = createDecipheriv("aes-256-gcm", key, m.subarray(0, 12));
    md.setAuthTag(m.subarray(12, 28));
    const manifest = JSON.parse(
      Buffer.concat([md.update(m.subarray(28)), md.final()]).toString(),
    );
    const d = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(manifest.iv, "hex"),
    );
    d.setAuthTag(Buffer.from(manifest.tag, "hex"));
    // pg_restore --schema-only can finish before consuming the archive's data blocks.
    // Authenticate the entire archive first; an early stdin close is then harmless.
    const archive = Buffer.concat([
      d.update(readFileSync(base + "production.dump.aes")),
      d.final(),
    ]);
    const p = spawn(
      "docker",
      [
        "run",
        "--rm",
        "--network",
        "none",
        "-i",
        "--entrypoint",
        "pg_restore",
        "public.ecr.aws/supabase/postgres:17.11.0.002",
        "--schema-only",
        "--no-owner",
        "--no-privileges",
        "--file=-",
      ],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    const chunks: Buffer[] = [];
    let size = 0;
    p.stdout.on("data", (b) => {
      size += b.length;
      if (size > 20e6) p.kill();
      else chunks.push(b);
    });
    let stderr = "";
    p.stderr.on("data", (b) => {
      if (stderr.length < 8000) stderr += b.toString();
      writeFileSync(privateDir + "/pgrestore-error.private.txt", stderr);
    });
    const done = new Promise<void>((ok, no) => {
      p.on("error", no);
      p.on("close", (c) =>
        c === 0 ? ok() : no(Error("Schema-only archive read failed: " + c)),
      );
    });
    let closed = false;
    p.stdin.on("error", () => {
      closed = true;
    });
    for (let offset = 0; offset < archive.length && !closed; offset += 65536) {
      await new Promise<void>((resolve) => {
        p.stdin.write(archive.subarray(offset, offset + 65536), () =>
          resolve(),
        );
      });
    }
    if (!closed) p.stdin.end();
    await done;
    archive.fill(0);
    const source = Buffer.concat(chunks).toString();
    assert(!/^COPY /m.test(source));
    writeFileSync(privateDir + "/schema-only.sql", source);
    writeFileSync(
      privateDir + "/local-roles.sql",
      manifest.roles
        .filter((r: any) => r.rolname !== "postgres")
        .map((r: any) => {
          assert.match(r.rolname, /^[a-z_][a-z_0-9]*$/);
          return `create role "${r.rolname}" nologin ${r.rolsuper ? "superuser" : "nosuperuser"} ${r.rolbypassrls ? "bypassrls" : "nobypassrls"};`;
        })
        .join("\n"),
    );
    const blocks = source
      .split(/(?=--\n-- Name: )/)
      .map((text) => {
        const h = text.match(
          /-- Name: (.+?); Type: ([^;]+); Schema: ([^;]+); Owner:/,
        );
        return h ? { name: h[1], type: h[2], schema: h[3], text } : null;
      })
      .filter(Boolean) as {
      name: string;
      type: string;
      schema: string;
      text: string;
    }[];
    const core = new Set([
      "credits_sandbox",
      "beta_packs",
      "season_catalogue",
      "beta_private",
      "beta_public",
      "beta_fantasy",
      "sports_feed",
      "nfl_roster",
      "commercial_billing",
    ]);
    const definitions = blocks.filter((b) =>
      [
        "TABLE",
        "FUNCTION",
        "VIEW",
        "TYPE",
        "SEQUENCE",
        "MATERIALIZED VIEW",
      ].includes(b.type),
    );
    const keyOf = (b: (typeof blocks)[number]) =>
      b.schema + "." + b.name.split("(")[0];
    const known = new Set(definitions.map(keyOf));
    const roots = [
      "credits_sandbox.state",
      "credits_sandbox.access",
      "credits_sandbox.pack_failures",
      "credits_sandbox.current_player_status",
      "credits_sandbox.current_player_jerseys",
      "beta_packs.catalogue",
      "beta_packs.capture",
      "beta_private.admitted",
      "beta_private.beta_gameplay_identity",
      "beta_private.gameplay_mfa_required",
      "beta_private.runtime_auth_users",
      "beta_private.runtime_auth_sessions",
      "beta_public.profiles",
      "sports_feed.open_weekly_core",
      "season_catalogue.can_issue",
    ];
    roots.push(
      "beta_fantasy.owned_collection_page",
      "sports_feed.my_weekly_core",
      "credits_sandbox.history",
      "credits_sandbox.journal",
      "credits_sandbox.lines",
      "beta_private.rate_limits",
      "credits_sandbox.market_card_visible",
      "credits_sandbox.assert_sport_fixture_member",
      "sports_feed.fixture_commerce_capability",
    );
    const selected = new Set(roots);
    let change = true;
    while (change) {
      change = false;
      for (const b of blocks) {
        const k = keyOf(b);
        let include = selected.has(k);
        if (
          [
            "CONSTRAINT",
            "FK CONSTRAINT",
            "TRIGGER",
            "ROW SECURITY",
            "POLICY",
            "DEFAULT",
          ].includes(b.type)
        )
          include = selected.has(b.schema + "." + b.name.split(" ")[0]);
        if (b.type === "SEQUENCE") {
          const table = b.text.match(
            /ALTER TABLE ([a-z_]+\.[a-z_]+) ALTER COLUMN/,
          );
          if (table && selected.has(table[1])) include = true;
        }
        if (b.type === "INDEX") {
          const target = b.text.match(/ ON ([a-z_]+\.[a-z_]+) /);
          include = !!target && selected.has(target[1]);
        }
        if (!include) continue;
        for (const m of b.text.matchAll(/\b([a-z_]+)\.([a-z_][a-z_0-9]*)/g)) {
          const ref = m[1] + "." + m[2];
          if (
            known.has(ref) &&
            ![
              "auth",
              "extensions",
              "pg_catalog",
              "information_schema",
            ].includes(m[1]) &&
            !selected.has(ref)
          ) {
            selected.add(ref);
            change = true;
          }
        }
      }
    }
    const missing = roots.filter((r) => !known.has(r));
    const selectedSchemas = [
      ...new Set([...selected].map((k) => k.split(".")[0])),
    ].sort();
    const result = {
      at: new Date().toISOString(),
      archiveAuthenticated: true,
      customerRowsExtracted: 0,
      productionConnections: 0,
      roots,
      missing,
      schemas: selectedSchemas,
      objectCount: selected.size,
      objects: [...selected].sort(),
      outsideInitialSchemas: selectedSchemas.filter((s) => !core.has(s)),
    };
    writeFileSync(
      dir + "/dependency-closure.json",
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({ ...result, objects: undefined, roots: undefined }),
    );
  } finally {
    key.fill(0);
  }
}
main().catch((error) => {
  writeFileSync(privateDir + "/schema-error.private.txt", String(error));
  console.error(
    "Schema-only dependency preparation stopped; no customer rows or hosted writes",
    error.name,
    error.code ?? "ARCHIVE",
  );
  process.exitCode = 1;
});
