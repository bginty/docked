import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  realpath,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { gzipSync, brotliCompressSync } from "node:zlib";
import {
  loadKnownSecrets,
  inspectSecretBytes,
  auditPreviewTargets,
} from "../../scripts/audit-preview-secrets.mjs";

const fixtureSecret = [
  "sb_",
  "secret_",
  "FICTIONAL_SCANNER_TEST_ONLY_12345",
].join("");
const fixturePassword = 'FICTIONAL p<&"ass:/%42';
const fixturePublishable =
  "sb_publishable_FICTIONAL_PUBLIC_CONFIGURATION_12345";
const scanner = fileURLToPath(
  new URL("../../scripts/audit-preview-secrets.mjs", import.meta.url),
);
function jwt(role: string) {
  return `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ role, iss: "fixture-supabase", ref: "fictional" })).toString("base64url")}.${"f".repeat(40)}`;
}
async function workspace(run: (root: string) => Promise<void>) {
  const base = await realpath(tmpdir());
  const root = await mkdtemp(path.join(base, "docked-secret-audit-"));
  try {
    await run(root);
  } finally {
    const absolute = await realpath(root);
    assert.equal(path.dirname(absolute), base);
    assert.ok(path.basename(absolute).startsWith("docked-secret-audit-"));
    await rm(absolute, { recursive: true });
  }
}
async function knownFixture(root: string) {
  await mkdir(path.join(root, "private-data/hosted-preview"), {
    recursive: true,
  });
  await writeFile(
    path.join(root, "private-data/hosted-preview/connection.json"),
    JSON.stringify({
      secretKey: fixtureSecret,
      publishableKey: fixturePublishable,
      databaseUrl: [
        "postgres://fixture:",
        encodeURIComponent(fixturePassword),
        "@localhost:5432/postgres",
      ].join(""),
    }),
  );
  await writeFile(
    path.join(root, ".env.local"),
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${fixturePublishable}\nSUPABASE_SECRET_KEY=${fixtureSecret}\nSMTP_PASSWORD="fictional separate SMTP password"\nODDS_API_KEY=\n`,
  );
}

test("artifact scanner loads only the two known credential files and excludes public keys", async () =>
  workspace(async (root) => {
    await knownFixture(root);
    await writeFile(
      path.join(root, "private-data/unrelated-credentials.json"),
      JSON.stringify({ secretKey: "not-authorised-for-discovery" }),
    );
    const known = await loadKnownSecrets(root);
    assert.equal(known.filesLoaded, 2);
    assert.ok(known.values.includes(fixtureSecret));
    assert.ok(known.values.includes(fixturePassword));
    assert.ok(known.values.includes("fictional separate SMTP password"));
    assert.ok(!known.values.includes(fixturePublishable));
    assert.ok(!known.values.includes("not-authorised-for-discovery"));
  }));

test("exact secrets are found in plain, URI, JSON, HTML/RSC and UTF-16 assets without returning values", () => {
  const values = [fixturePassword];
  const encoded = [
    fixturePassword,
    encodeURIComponent(fixturePassword),
    JSON.stringify(fixturePassword).slice(1, -1),
    fixturePassword
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll('"', "&quot;"),
    JSON.stringify(fixturePassword)
      .slice(1, -1)
      .replaceAll("<", "\\u003c")
      .replaceAll("&", "\\u0026"),
    Buffer.from(fixturePassword).toString("base64"),
    Buffer.from(fixturePassword).toString("base64url"),
  ];
  for (const value of encoded) {
    const result = inspectSecretBytes(Buffer.from(value), values);
    assert.equal(result.exactMatches, 1);
    assert.deepEqual(Object.keys(result), ["exactMatches", "patternMatches"]);
    assert.ok(!JSON.stringify(result).includes(fixturePassword));
  }
  assert.equal(
    inspectSecretBytes(Buffer.from(fixturePassword, "utf16le"), values)
      .exactMatches,
    1,
  );
});

test("generic signatures flag privileged keys, JWTs, credentials, private keys and canaries", () => {
  for (const value of [
    fixtureSecret,
    jwt("service_role"),
    jwt("authenticated"),
    ["postgres://fixture:", "password", "@db.example.invalid/postgres"].join(
      "",
    ),
    ["-----BEGIN ", "PRIVATE KEY-----"].join(""),
    "DOCKED_BUILD_CANARY_EMAIL_TEST",
    "SMTP_PASSWORD=another-fictional-credential",
    'SUPABASE_SECRET_KEY: "unprefixed-long-fictional-credential"',
  ])
    assert.ok(
      inspectSecretBytes(Buffer.from(value)).patternMatches > 0,
      value.split(":")[0],
    );
  const safe = `${fixturePublishable}\n${jwt("anon")}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${fixturePublishable}\nSUPABASE_SECRET_KEY=\nconst x = process.env.SUPABASE_SECRET_KEY;`;
  assert.ok(
    inspectSecretBytes(Buffer.from(fixtureSecret, "utf16le")).patternMatches >
      0,
  );
  assert.ok(
    inspectSecretBytes(
      Buffer.concat([Buffer.from([0]), Buffer.from(fixtureSecret, "utf16le")]),
    ).patternMatches > 0,
  );
  assert.deepEqual(inspectSecretBytes(Buffer.from(safe)), {
    exactMatches: 0,
    patternMatches: 0,
  });
});

test("explicit target audit scans compressed JS and extracted APK bytes but refuses unreadable paths and archives", async () =>
  workspace(async (root) => {
    await mkdir(path.join(root, "export"));
    await writeFile(
      path.join(root, "export/public.js"),
      "const publicConfig = 'sb_publishable_FICTIONAL_PUBLIC_CONFIG';",
    );
    await writeFile(
      path.join(root, "export/page.html"),
      `<script>${fixtureSecret}</script>`,
    );
    await writeFile(
      path.join(root, "export/stream.rsc"),
      gzipSync(fixturePassword),
    );
    await writeFile(
      path.join(root, "export/bundle.js.gz"),
      gzipSync(fixturePassword),
    );
    await writeFile(
      path.join(root, "export/bundle.js.br"),
      brotliCompressSync(fixtureSecret),
    );
    await writeFile(
      path.join(root, "export/classes.dex"),
      Buffer.concat([
        Buffer.from([0, 1, 2]),
        Buffer.from(fixturePassword, "utf16le"),
      ]),
    );
    const report = await auditPreviewTargets(
      ["export"],
      [fixtureSecret, fixturePassword],
      root,
    );
    assert.equal(report.status, "FAIL");
    assert.equal(report.filesScanned, 6);
    assert.ok(report.findings.some((f) => f.file === "export/page.html"));
    assert.ok(report.findings.some((f) => f.file === "export/bundle.js.gz"));
    assert.ok(report.findings.some((f) => f.file === "export/bundle.js.br"));
    assert.ok(report.findings.some((f) => f.file === "export/classes.dex"));
    assert.ok(report.findings.some((f) => f.file === "export/stream.rsc"));
    assert.ok(!JSON.stringify(report).includes(fixtureSecret));
    assert.ok(!JSON.stringify(report).includes(fixturePassword));
    await writeFile(
      path.join(root, "app.apk"),
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    );
    const blocked = await auditPreviewTargets(["app.apk", "absent"], [], root);
    assert.equal(blocked.status, "FAIL");
    assert.ok(
      blocked.errors.some((e) => e.code === "EXTRACT_ARCHIVE_BEFORE_SCANNING"),
    );
    assert.ok(
      blocked.errors.some((e) => e.code === "UNREADABLE_OR_INVALID_FILE"),
    );
    assert.equal((await auditPreviewTargets([], [], root)).status, "FAIL");
  }));

test("compressed containers cannot conceal unscanned archive entries", async () =>
  workspace(async (root) => {
    const zipSignatures = [
      [0x50, 0x4b, 0x03, 0x04],
      [0x50, 0x4b, 0x05, 0x06],
      [0x50, 0x4b, 0x07, 0x08],
    ];
    for (const [index, signature] of zipSignatures.entries()) {
      const bytes = Buffer.concat([
        Buffer.from(signature),
        gzipSync(fixtureSecret),
      ]);
      await writeFile(path.join(root, `nested-${index}.gz`), gzipSync(bytes));
      await writeFile(
        path.join(root, `nested-${index}.br`),
        brotliCompressSync(bytes),
      );
    }
    await writeFile(
      path.join(root, "double.gz"),
      gzipSync(gzipSync(fixtureSecret)),
    );
    const report = await auditPreviewTargets([root], [fixtureSecret], root);
    assert.equal(report.status, "FAIL");
    assert.equal(report.filesScanned, 0);
    assert.equal(
      report.errors.filter((e) => e.code === "EXTRACT_ARCHIVE_BEFORE_SCANNING")
        .length,
      7,
    );
    assert.ok(!JSON.stringify(report).includes(fixtureSecret));
  }));

test("filenames containing secret values are redacted and safe scanned content passes", async () =>
  workspace(async (root) => {
    await writeFile(path.join(root, fixtureSecret + ".js"), fixtureSecret);
    const report = await auditPreviewTargets(
      [fixtureSecret + ".js"],
      [fixtureSecret],
      root,
    );
    assert.match(report.findings[0].file, /^\[redacted-path-/);
    assert.ok(!JSON.stringify(report).includes(fixtureSecret));
    await writeFile(
      path.join(root, "safe.html"),
      `<p>PREVIEW</p><script>window.publicKey='${fixturePublishable}'</script>`,
    );
    const safe = await auditPreviewTargets(
      ["safe.html"],
      [fixtureSecret],
      root,
    );
    assert.equal(safe.status, "PASS");
    assert.equal(safe.filesScanned, 1);
  }));

test("CLI reports filenames and counts without credentials, never changes inputs and refuses invalid known sources", async () =>
  workspace(async (root) => {
    await knownFixture(root);
    await writeFile(path.join(root, "safe.js"), "const preview = true;");
    const run = (...args: string[]) =>
      execFileSync(process.execPath, [scanner, ...args], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    const before = await readFile(path.join(root, ".env.local"), "utf8");
    const output = run("safe.js");
    assert.equal(JSON.parse(output).status, "PASS");
    assert.ok(!output.includes(fixtureSecret));
    assert.equal(await readFile(path.join(root, ".env.local"), "utf8"), before);
    await writeFile(path.join(root, "leaked.js"), fixtureSecret);
    try {
      run("leaked.js");
      assert.fail("leak must fail");
    } catch (error) {
      const e = error as { stdout?: string; stderr?: string };
      assert.equal(JSON.parse(String(e.stdout)).status, "FAIL");
      assert.ok(!String(e.stdout).includes(fixtureSecret));
      assert.ok(!String(e.stderr).includes(fixtureSecret));
    }
    await writeFile(
      path.join(root, "private-data/hosted-preview/connection.json"),
      `{ ${fixtureSecret}`,
    );
    try {
      run("safe.js");
      assert.fail("invalid known source must fail");
    } catch (error) {
      const e = error as { stdout?: string; stderr?: string };
      assert.equal(
        JSON.parse(String(e.stdout)).errors[0].code,
        "KNOWN_SOURCE_INVALID",
      );
      assert.ok(!String(e.stdout).includes(fixtureSecret));
      assert.ok(!String(e.stderr).includes(fixtureSecret));
    }
  }));
