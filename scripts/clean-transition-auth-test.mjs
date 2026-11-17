/** Genuine local GoTrue HTTP lifecycle, fake numbers + internal SMTP sink only. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync, execFile } from "node:child_process";
import { randomBytes, createHmac } from "node:crypto";
import { SignJWT } from "jose";
import assert from "node:assert/strict";
const dir = "private-data/clean-transition-20261117",
  cfg = JSON.parse(readFileSync(dir + "/auth-local.private.json", "utf8"));
assert.equal(cfg.auth, "docked-clean-auth-20261117");
const docker = (args, input) =>
  execFileSync("docker", args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
assert.equal(
  JSON.parse(docker(["network", "inspect", cfg.network]))[0].Internal,
  true,
);
const admin = await new SignJWT({ role: "service_role" })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(cfg.jwt));
async function api(method, path, body, token, mail = false) {
  const request = {
    url: `http://${mail ? cfg.sink : cfg.auth}:${mail ? "8025" : "9999"}${path}`,
    method,
    body,
    token,
  };
  const driver =
    "const fs=require('fs');const p=JSON.parse(fs.readFileSync(0,'utf8'));fetch(p.url,{method:p.method,headers:{'Content-Type':'application/json',...(p.token?{Authorization:'Bearer '+p.token}:{})},body:p.body===undefined?undefined:JSON.stringify(p.body),signal:AbortSignal.timeout(15000)}).then(async r=>console.log(JSON.stringify({status:r.status,data:await r.json()}))).catch(()=>{console.error('Isolated HTTP request failed');process.exitCode=1});";
  const raw = await new Promise((resolve, reject) => {
    const cp = execFile(
      "docker",
      [
        "run",
        "--rm",
        "--network",
        cfg.network,
        "-i",
        "node:22-alpine",
        "node",
        "-e",
        driver,
      ],
      { encoding: "utf8", windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) =>
        error ? reject(Error("Isolated HTTP driver failed")) : resolve(stdout),
    );
    cp.stdin.end(JSON.stringify(request));
  });
  return JSON.parse(raw);
}
const db = (s) =>
  docker(
    [
      "exec",
      "-i",
      cfg.db,
      "psql",
      "-U",
      "postgres",
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    s,
  ).trim();
const q = (s) => "'" + s.replaceAll("'", "''") + "'";
// Previous disposable runs only; never load or touch Production identities.
if (existsSync(dir + "/auth-fixtures.private.json")) {
  const previous = JSON.parse(
    readFileSync(dir + "/auth-fixtures.private.json", "utf8"),
  );
  for (const id of previous.ids) {
    assert.match(id, /^[a-f0-9-]{36}$/);
    assert.equal(
      db(
        `select count(*)from auth.users where id=${q(id)}and(email like '%@lifecycle.invalid' or deleted_at is not null)`,
      ),
      "1",
    );
    assert.equal(
      (
        await api(
          "DELETE",
          "/admin/users/" + id,
          { should_soft_delete: true },
          admin,
        )
      ).status,
      200,
    );
  }
}
function totp(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = secret
    .replace(/=+$/, "")
    .split("")
    .map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0"))
    .join("");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const mac = createHmac("sha1", key).update(counter).digest(),
    offset = mac[19] & 15;
  return ((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
async function mfa(session) {
  const enrollment = await api(
    "POST",
    "/factors",
    { factor_type: "totp", friendly_name: "Isolated individual authenticator" },
    session.access_token,
  );
  assert.equal(enrollment.status, 200, JSON.stringify(enrollment));
  const challenge = await api(
    "POST",
    "/factors/" + enrollment.data.id + "/challenge",
    {},
    session.access_token,
  );
  assert.equal(challenge.status, 200);
  const verified = await api(
    "POST",
    "/factors/" + enrollment.data.id + "/verify",
    {
      challenge_id: challenge.data.id,
      code: totp(enrollment.data.totp.secret),
    },
    session.access_token,
  );
  assert.equal(verified.status, 200, JSON.stringify(verified));
  assert.equal(
    JSON.parse(
      Buffer.from(verified.data.access_token.split(".")[1], "base64url"),
    ).aal,
    "aal2",
  );
  return verified.data;
}
const health = await api("GET", "/health");
assert.equal(health.data.version, "v2.198.0");
const source = readFileSync(
  "supabase/migrations/20261117001019_clean_commercial_account_transition.sql",
  "utf8",
);
const sync = source.match(
  /create or replace function private\.sync_verified_phone_claim\(\)[\s\S]*?end\$\$;/,
)[0];
db(`create schema if not exists private;create schema if not exists lifecycle_evidence;
create table if not exists private.verified_phone_claims(canonical_phone text primary key,user_id uuid unique not null);
${sync}
drop trigger if exists docked_verified_phone_claim on auth.users;
create trigger docked_verified_phone_claim before insert or delete or update of id,phone,phone_confirmed_at on auth.users for each row execute function private.sync_verified_phone_claim();
create table if not exists lifecycle_evidence.assets(id text primary key,user_id uuid references auth.users on delete restrict,detail jsonb not null);
`);
const checks = [],
  created = [],
  run = Date.now(),
  password = randomBytes(24).toString("base64url");
const ok = (label, value) => {
  assert(value, label);
  checks.push(label);
};
const create = async (name, phone) => {
  const email = `${name}-${run}@lifecycle.invalid`,
    r = await api(
      "POST",
      "/admin/users",
      {
        email,
        password,
        email_confirm: true,
        ...(phone ? { phone, phone_confirm: true } : {}),
      },
      admin,
    );
  assert.equal(r.status, 200, JSON.stringify(r));
  created.push(r.data.id);
  return { id: r.data.id, email, phone };
};
const login = async (u) => {
  const r = await api("POST", "/token?grant_type=password", {
    email: u.email,
    password,
  });
  assert.equal(r.status, 200, JSON.stringify(r));
  return r.data;
};
try {
  const old = await create("retiring", "+61400000001"),
    other = await create("unrelated", "+61400000002"),
    owner = await create("owner");
  const session = await login(old),
    ownerSession = await mfa(await login(owner));
  ok(
    "Retained Owner uses individual verified Auth MFA",
    db(
      `select count(*)from auth.mfa_factors where user_id=${q(owner.id)}and status='verified'`,
    ) === "1",
  );
  db(
    `insert into lifecycle_evidence.assets values(${q("asset-" + run)},${q(old.id)},'{"serial":1,"rarity":"ICON","issued":1,"recoveryHold":5700,"testReceipt":true}');`,
  );
  const hashBefore = db(
    "select md5(jsonb_agg(to_jsonb(a)order by id)::text)from lifecycle_evidence.assets a;",
  );
  ok(
    "Confirmed old phone claimed",
    db(
      `select count(*)from private.verified_phone_claims where user_id=${q(old.id)}`,
    ) === "1",
  );
  const deletion = await api(
    "DELETE",
    "/admin/users/" + old.id,
    { should_soft_delete: true },
    admin,
  );
  assert.equal(deletion.status, 200, JSON.stringify(deletion));
  ok(
    "Soft deletion retains original UUID/tombstone",
    db(
      `select count(*)from auth.users where id=${q(old.id)}and deleted_at is not null`,
    ) === "1",
  );
  ok(
    "Old email and password no longer authenticate",
    (
      await api("POST", "/token?grant_type=password", {
        email: old.email,
        password,
      })
    ).status >= 400,
  );
  ok(
    "Existing Auth access token is rejected",
    (await api("GET", "/user", undefined, session.access_token)).status >= 400,
  );
  ok(
    "Old refresh token is revoked",
    (
      await api("POST", "/token?grant_type=refresh_token", {
        refresh_token: session.refresh_token,
      })
    ).status >= 400,
  );
  ok(
    "All old sessions removed",
    db(`select count(*)from auth.sessions where user_id=${q(old.id)}`) === "0",
  );
  ok(
    "Retired phone released",
    db(
      `select count(*)from private.verified_phone_claims where user_id=${q(old.id)}`,
    ) === "0",
  );
  ok(
    "Unrelated verified phone remains claimed",
    db(
      `select count(*)from private.verified_phone_claims where user_id=${q(other.id)}`,
    ) === "1",
  );
  ok(
    "Repeated soft delete is idempotent",
    (
      await api(
        "DELETE",
        "/admin/users/" + old.id,
        { should_soft_delete: true },
        admin,
      )
    ).status === 200,
  );
  const signup = await api("POST", "/signup", { email: old.email, password });
  assert.equal(signup.status, 200, JSON.stringify(signup));
  const next = signup.data.id ?? signup.data.user?.id;
  ok("Normal signup reuses email with NEW UUID", !!next && next !== old.id);
  created.push(next);
  ok(
    "Replacement has no inherited email or phone verification",
    db(
      `select count(*)from auth.users where id=${q(next)}and email_confirmed_at is null and phone_confirmed_at is null`,
    ) === "1",
  );
  ok(
    "Replacement cannot log in before its email verification",
    (
      await api("POST", "/token?grant_type=password", {
        email: old.email,
        password,
      })
    ).status >= 400,
  );
  const messages = await api(
    "GET",
    "/api/v1/messages",
    undefined,
    undefined,
    true,
  );
  const message = messages.data.messages.find((m) =>
    m.To.some((a) => a.Address === old.email),
  );
  assert(message, "Local confirmation email missing");
  const detail = await api(
    "GET",
    "/api/v1/message/" + message.ID,
    undefined,
    undefined,
    true,
  );
  const content = (detail.data.Text ?? "") + " " + (detail.data.HTML ?? "");
  const token = content.match(/[?&]token=([^&\s"<>]+)/)?.[1];
  assert(token, "Confirmation token missing in local sink");
  const verified = await api("POST", "/verify", {
    type: "signup",
    token_hash: decodeURIComponent(token),
  });
  assert.equal(verified.status, 200, JSON.stringify(verified));
  const fresh = verified.data.access_token
    ? verified.data
    : await login({ email: old.email });
  ok(
    "Email possession newly verified",
    db(
      `select count(*)from auth.users where id=${q(next)}and email_confirmed_at is not null and phone_confirmed_at is null`,
    ) === "1",
  );
  const enroll = await api(
    "PUT",
    "/user",
    { phone: old.phone },
    fresh.access_token,
  );
  assert.equal(enroll.status, 200, JSON.stringify(enroll));
  ok(
    "Phone change does not inherit old verification",
    db(
      `select count(*)from auth.users where id=${q(next)}and phone_confirmed_at is null`,
    ) === "1",
  );
  const verifyPhone = await api(
    "POST",
    "/verify",
    { type: "phone_change", phone: old.phone, token: "123456" },
    fresh.access_token,
  );
  assert.equal(verifyPhone.status, 200, JSON.stringify(verifyPhone));
  ok(
    "Fresh phone verification establishes NEW UUID claim",
    db(
      `select count(*)from private.verified_phone_claims where user_id=${q(next)}and canonical_phone='61400000001'`,
    ) === "1",
  );
  const race = await Promise.all(
    ["a", "b"].map((name) =>
      api(
        "POST",
        "/admin/users",
        {
          email: `race-${name}-${run}@lifecycle.invalid`,
          password,
          email_confirm: true,
          phone: "+61400000003",
          phone_confirm: true,
        },
        admin,
      ),
    ),
  );
  ok(
    "Concurrent verification: exactly one owner of a number",
    race.filter((r) => r.status === 200).length === 1 &&
      db(
        "select count(*)from private.verified_phone_claims where canonical_phone='61400000003'",
      ) === "1",
  );
  for (const r of race) if (r.status === 200) created.push(r.data.id);
  ok(
    "Duplicate active phone rejected",
    (
      await api(
        "PUT",
        "/admin/users/" + other.id,
        { phone: old.phone, phone_confirm: true },
        admin,
      )
    ).status >= 400,
  );
  ok(
    "Old financial/serial/hold records unchanged",
    db(
      "select md5(jsonb_agg(to_jsonb(a)order by id)::text)from lifecycle_evidence.assets a;",
    ) === hashBefore,
  );
  ok(
    "New account has zero historical assets",
    db(
      `select count(*)from lifecycle_evidence.assets where user_id=${q(next)}`,
    ) === "0",
  );
  ok(
    "Retained Owner original session/login unchanged",
    (await api("GET", "/user", undefined, ownerSession.access_token)).status ===
      200,
  );
  const result = {
    at: new Date().toISOString(),
    version: health.data.version,
    checks,
    externalDeliveries: 0,
    phoneVerification: "Local provider test OTP only; no claim of genuine SMS",
    productionWrites: 0,
  };
  writeFileSync(
    "docs/qa/clean-transition-20261117/auth-lifecycle-tests.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} catch (e) {
  writeFileSync(dir + "/auth-test-error.private.txt", e.stack, { mode: 0o600 });
  console.error(e.message);
  process.exitCode = 1;
} finally {
  writeFileSync(
    dir + "/auth-fixtures.private.json",
    JSON.stringify({ run, ids: created }),
    { mode: 0o600 },
  );
}
