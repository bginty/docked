// Exact Docked project only. Never logs credentials or accesses factor secrets.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import postgres from "postgres";
import { databaseConnectionOptions } from "../src/server/database-tls.ts";
export const projectRef = "pojoymtniryarxxunyvz";
export function ownerRuntimeDatabase() {
  const c = JSON.parse(
    readFileSync(
      "private-data/production/beta-runtime-connection.json",
      "utf8",
    ),
  );
  assert.equal(c.projectRef, projectRef);
  assert.equal(c.databaseRole, "docked_beta_app");
  const url = new URL(c.databaseUrl);
  assert.equal(url.username, `docked_beta_app.${projectRef}`);
  assert.match(url.hostname, /^aws-\d+-ap-southeast-2\.pooler\.supabase\.com$/);
  return postgres(url.href, {
    ...databaseConnectionOptions(url.href, {
      DATABASE_SSL_CA_FILE: resolve("certs/supabase-prod-ca-2021.crt"),
    }),
    max: 8,
    connect_timeout: 15,
    onnotice: () => {},
  });
}
export function ownerDatabase() {
  const base = "private-data/production/";
  const provision = JSON.parse(
    readFileSync(base + "provision-request.json", "utf8"),
  );
  assert.equal(provision.organizationId, "otldyeunbqabbcjydjpe");
  assert.equal(
    readFileSync(
      base + "provider-config/supabase/.temp/project-ref",
      "utf8",
    ).trim(),
    projectRef,
  );
  const url = new URL(
    readFileSync(
      base + "provider-config/supabase/.temp/pooler-url",
      "utf8",
    ).trim(),
  );
  assert.equal(url.username, `postgres.${projectRef}`);
  assert.match(url.hostname, /^aws-\d+-ap-southeast-2\.pooler\.supabase\.com$/);
  url.password = provision.databasePassword;
  return postgres(url.href, {
    ...databaseConnectionOptions(url.href, {
      DATABASE_SSL_CA_FILE: resolve("certs/supabase-prod-ca-2021.crt"),
    }),
    max: 3,
    connect_timeout: 15,
    onnotice: () => {},
  });
}
