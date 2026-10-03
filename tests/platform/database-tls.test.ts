import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ConnectionOptions, PeerCertificate } from "node:tls";
import postgres from "postgres";
import { databaseConnectionOptions } from "../../src/server/database-tls";

const host = "db.fictional-preview.example.invalid";
const remote = `postgres://fictional:never-a-real-password@${host}:5432/postgres`;
const caFile = path.resolve("certs/supabase-prod-ca-2021.crt");

test("actual Postgres.js parsing cannot downgrade remote certificate verification through URL TLS options", async () => {
  for (const query of [
    "sslmode=require",
    "sslmode=disable",
    "sslmode=prefer",
    "sslmode=allow",
    "ssl=false",
    "ssl=disable",
    "sslrootcert=system&sslmode=disable",
  ]) {
    const url = `${remote}?${query}`;
    const client = postgres(url, {
      ...databaseConnectionOptions(url, {}),
      max: 1,
    });
    try {
      const tls = client.options.ssl as ConnectionOptions;
      assert.equal(tls.rejectUnauthorized, true, query);
      assert.equal(typeof tls.checkServerIdentity, "function");
      assert.deepEqual(client.options.host, [host]);
      assert.deepEqual(client.options.port, [5432]);
    } finally {
      await client.end(); // No query was made, so the driver never opens a connection.
    }
  }
});

test("explicit remote TLS and URL target also override ambient PostgreSQL TLS/host/port variables", async () => {
  const original = {
    PGSSL: process.env.PGSSL,
    PGPORT: process.env.PGPORT,
    PGHOST: process.env.PGHOST,
  };
  process.env.PGSSL = "disable";
  process.env.PGPORT = "6543";
  process.env.PGHOST = "unrelated.example.invalid";
  const url = `postgres://fictional:never-a-real-password@${host}/postgres`;
  const client = postgres(url, databaseConnectionOptions(url, {}));
  try {
    assert.equal(
      (client.options.ssl as ConnectionOptions).rejectUnauthorized,
      true,
    );
    assert.deepEqual(client.options.host, [host]);
    assert.deepEqual(client.options.port, [5432]);
  } finally {
    await client.end();
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("reviewed absolute CA is loaded; missing, relative, malformed or private-key material never falls back", async () => {
  const options = databaseConnectionOptions(remote, {
    DATABASE_SSL_CA_FILE: caFile,
  });
  assert.equal((options.ssl as ConnectionOptions).rejectUnauthorized, true);
  assert.match(
    (options.ssl as ConnectionOptions).ca as string,
    /BEGIN CERTIFICATE/,
  );
  assert.throws(
    () =>
      databaseConnectionOptions(remote, {
        DATABASE_SSL_CA_FILE: "certs/supabase-prod-ca-2021.crt",
      }),
    /absolute path/,
  );
  const directory = await mkdtemp(path.join(tmpdir(), "docked-tls-test-"));
  const file = path.join(directory, "invalid-ca.pem");
  try {
    assert.throws(
      () => databaseConnectionOptions(remote, { DATABASE_SSL_CA_FILE: file }),
      /verification remains required/,
    );
    for (const contents of [
      "not a certificate",
      "-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----",
      "-----BEGIN PRIVATE KEY-----\nnot-a-key\n-----END PRIVATE KEY-----",
    ]) {
      await writeFile(file, contents);
      assert.throws(
        () => databaseConnectionOptions(remote, { DATABASE_SSL_CA_FILE: file }),
        /verification remains required/,
      );
    }
  } finally {
    await unlink(file);
    await rmdir(directory);
  }
});

test("certificate identity stays bound to the requested host, including IP targets", () => {
  const tls = databaseConnectionOptions(remote, {}).ssl as ConnectionOptions;
  const certificate = {
    subjectaltname: `DNS:${host}`,
    subject: { CN: host },
  } as PeerCertificate;
  assert.equal(
    tls.checkServerIdentity!("ignored.example.invalid", certificate),
    undefined,
  );
  assert.ok(
    tls.checkServerIdentity!(host, {
      ...certificate,
      subjectaltname: "DNS:wrong.example.invalid",
    }),
  );
  const ip = databaseConnectionOptions(
    "postgres://fictional:secret@203.0.113.5:5432/postgres",
    {},
  ).ssl as ConnectionOptions;
  assert.equal(
    ip.checkServerIdentity!("localhost", {
      subjectaltname: "IP Address:203.0.113.5",
      subject: {},
    } as PeerCertificate),
    undefined,
  );
  assert.ok(ip.checkServerIdentity!("localhost", certificate));
});

test("local-only databases preserve plaintext development; ambiguous multi-host and non-PostgreSQL targets fail", async () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    const url = `postgres://fictional:secret@${host}:54322/postgres?sslmode=require`;
    const client = postgres(url, databaseConnectionOptions(url, {}));
    assert.equal(client.options.ssl, false);
    assert.deepEqual(client.options.port, [54322]);
    assert.deepEqual(client.options.host, [host.replace(/^\[|\]$/g, "")]);
    await client.end();
  }
  for (const url of [
    "https://example.invalid/postgres",
    "postgres://localhost,remote.example.invalid/postgres",
    `${remote}#ignored`,
  ])
    assert.throws(() => databaseConnectionOptions(url, {}));
  assert.equal(
    (
      databaseConnectionOptions(
        "postgres://fictional:secret@localhost.example.invalid/postgres",
        {},
      ).ssl as ConnectionOptions
    ).rejectUnauthorized,
    true,
  );
});
