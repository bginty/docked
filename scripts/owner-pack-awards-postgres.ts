/** Actual ledger and SQL guards, isolated loopback PostgreSQL and fictional identities only. */
import assert from "node:assert/strict";
import crypto, { createHash, randomBytes, randomUUID } from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import { spawnSync } from "node:child_process";
import { mock } from "node:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import postgres, { type Sql } from "postgres";
import { CommercialLedger } from "../src/server/commercial-ledger";
import { CommercialMemberView } from "../src/server/commercial-member-view";
import {
  commercialPack,
  commercialPolicyVersion,
  commercialProducts,
  type CommercialReceipt,
  type CommercialSport,
} from "../src/core/commercial-billing";
import { limitedRarities, rarityRule } from "../src/core/card-rarity";
import type { OwnerPackAwardCommand } from "../src/core/owner-pack-awards";
import { currentRosterPostgresChecks } from "./current-rosters-postgres-checks";

const url = new URL(process.env.COMMERCIAL_ACCEPTANCE_DB ?? "");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.pathname, "/commercial_acceptance");
const admin = postgres(url.href, { max: 8, onnotice: () => {} });
let runtime: Sql;
let ledger: CommercialLedger;
const versions = { terms: "2026-11-isolated", privacy: "2026-11-isolated" };
const owner = randomUUID();
const ownerSession = randomUUID();
const recipient = randomUUID();
const other = randomUUID();
const checks: string[] = [];
const fixtureTokens = new Map<string, string>();
let testedRosterMigrationHash: string;
const migration = "supabase/migrations/20261122005246_owner_pack_awards.sql";
let phoneSequence = 0;
const noAuthorisation = async () => {};

function source(file: string) {
  return readFileSync(file, "utf8");
}
function actualFunction(file: string, name: string) {
  const sql = source(file);
  const pattern = new RegExp(
    `create (?:or replace )?function ${name.replaceAll(".", "\\.")}\\(`,
    "i",
  );
  const start = sql.search(pattern);
  assert(start >= 0, `Actual helper ${name} must exist`);
  const body = sql.indexOf("$$", start);
  const end = sql.indexOf("$$;", body + 2);
  assert(body > start && end > body);
  return sql.slice(start, end + 3);
}
function authorise(
  actor: string = owner,
  session: string = ownerSession,
  aal = "aal2",
) {
  return async (tx: Sql) => {
    await tx`select set_config('request.jwt.claim.sub',${actor},true),set_config('request.jwt.claims',${JSON.stringify({ sub: actor, session_id: session, aal })},true)`;
  };
}
function command(
  overrides: Partial<OwnerPackAwardCommand> = {},
): OwnerPackAwardCommand {
  return {
    request: randomUUID(),
    member: recipient,
    reason: "PROMOTION",
    reference: "Isolated launch promotion",
    confirmed: true,
    lines: [line("nfl", "PREMIUM", 1), line("nfl", "STANDARD", 9)],
    ...overrides,
  };
}
function line(
  sport: CommercialSport,
  family: "STANDARD" | "PREMIUM",
  size: 1 | 3 | 9,
  quantity = 1,
) {
  return {
    sport,
    family,
    size,
    quantity,
    configurationHash: commercialPack(sport, family, size).configurationHash,
  };
}
async function award(input = command(), actor = owner, auth = authorise()) {
  return ledger.awardPacks(actor, input, auth, versions);
}
async function check(name: string, run: () => Promise<void>) {
  await run();
  checks.push(name);
  console.log(`PASS ${name}`);
}
async function zeroDraw<T>(run: () => Promise<T>) {
  const patch = mock.method(crypto, "randomInt", () => 0);
  syncBuiltinESMExports();
  try {
    return await run();
  } finally {
    patch.mock.restore();
    syncBuiltinESMExports();
  }
}
async function identity(id: string, role?: string, session?: string) {
  const phone = `614${String(++phoneSequence).padStart(8, "0")}`;
  await admin`insert into auth.users(id,email,email_confirmed_at,phone,phone_confirmed_at) values(${id},${`${id}@pack-fixture.invalid`},clock_timestamp(),${phone},clock_timestamp())`;
  await admin`insert into public.profiles(id,country,state,age_attested,accepted_version) values(${id},'AU','NSW',true,${versions.terms})`;
  await admin`insert into private.verified_phone_claims(canonical_phone,user_id) values(${phone},${id})`;
  await admin`insert into private.social_profiles(user_id,display_name) values(${id},${role ? `Isolated ${role}` : "Fictional customer"})`;
  await admin`insert into private.consent_events(user_id,purpose,granted,version) values(${id},'privacy',true,${versions.privacy})`;
  if (role)
    await admin`insert into private.roles(user_id,role) values(${id},${role})`;
  if (session)
    await admin`insert into auth.sessions(id,user_id,not_after) values(${session},${id},clock_timestamp()+interval '1 day')`;
}
async function definitions(sport: CommercialSport, terminal = false) {
  for (let n = 0; n < (terminal ? 1 : 20); n++) {
    const player = randomUUID();
    for (const rarity of limitedRarities) {
      const cap = rarityRule(rarity).lifetimeCap!;
      const prior = terminal ? cap - 1 : 0;
      await admin`insert into commercial_billing.definitions(player_id,sport,rarity,lifetime_cap,issued,legacy_issued,approved,rights_reference,snapshot) values(${player},${sport},${rarity},${cap},${prior},${prior},true,'FICTIONAL LOOPBACK FIXTURE ONLY',${admin.json({ name: `Fixture ${sport} ${n}`, team: "Fixture", position: sport === "nfl" ? "QB" : "WFB", season: "ISOLATED", status: "active", synthetic: true, colour: "#16345A", verifiedJerseyNumber: null })})`;
    }
  }
}
async function fingerprint(financialOnly = false) {
  const tables = financialOnly
    ? [
        "receipts",
        "receipt_events",
        "lots",
        "journals",
        "lines",
        "recovery_cases",
        "jobs",
      ]
    : [
        "accounts",
        "receipts",
        "receipt_events",
        "lots",
        "journals",
        "lines",
        "recovery_cases",
        "jobs",
        "definitions",
        "packs",
        "cards",
        "ownership_events",
        "audit",
        "pack_awards",
      ];
  const result: Record<string, string> = {};
  for (const table of tables) {
    const [row] = await admin.unsafe(
      `select md5(coalesce(string_agg(t::text,',' order by t::text),'')) h from(select to_jsonb(x)t from commercial_billing.${table} x)s`,
    );
    result[table] = row.h;
  }
  return result;
}
async function funded(member: string) {
  const token = `LOOPBACK-FIXTURE-${randomUUID()}`;
  const product = commercialProducts.find((p) => p.credits === 9900)!;
  const receipt: CommercialReceipt = {
    key: createHash("sha256")
      .update("docked.fantasy\0" + token)
      .digest("hex"),
    account: "b".repeat(64),
    environment: "acceptance",
    product,
    state: "PURCHASED",
    consumed: false,
    paid: true,
    orderId: `LOOPBACK-${randomUUID()}`,
    grossCents: product.audCents,
    taxCents: null,
    refundedCents: 0,
    providerAt: new Date().toISOString(),
  };
  await ledger.accept(receipt, member, token, noAuthorisation);
  fixtureTokens.set(receipt.key, token);
  return receipt;
}
async function bootstrap() {
  await admin.unsafe(`
    create role anon; create role authenticated; create role service_role;
    create role docked_app; create role docked_beta_app;
    create schema auth; create schema private; create schema launch_transition;
    create schema operations; create schema sms_delivery; create schema beta_packs;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}') $$;
    create table public.profiles(id uuid primary key,country text,state text,age_attested boolean,accepted_version text,disabled_at timestamptz,created_at timestamptz default clock_timestamp());
    create table private.roles(user_id uuid primary key,role text);
    create table private.social_profiles(user_id uuid primary key,display_name text);
    create table private.social_reports(created_at timestamptz);
    create table private.verified_phone_claims(canonical_phone text primary key,user_id uuid unique);
    create table private.consent_events(id bigint generated always as identity,user_id uuid,purpose text,granted boolean,version text,created_at timestamptz default clock_timestamp());
    create table private.region_policies(id bigint generated always as identity,country text,state text,effective_from timestamptz,effective_to timestamptz,preview_community_only boolean,approved boolean,minimum_age int,review_at timestamptz);
    create table private.feature_flags(enabled boolean);
    create table launch_transition.accounts(user_id uuid primary key,kind text);
    create table sms_delivery.windows(enabled boolean,allowlist uuid[],starts_at timestamptz,expires_at timestamptz,budget_aud_cents int,reserved_aud_cents int);
    create table beta_packs.issued(card uuid,definition uuid,serial int);
    grant usage on schema private,auth to docked_app;
  `);
  await admin.unsafe(
    source("supabase/migrations/20261101120754_commercial_google_ledger.sql"),
  );
  await admin.unsafe(
    actualFunction(
      "supabase/migrations/20261109232124_operational_incident_review.sql",
      "operations.immutable",
    ),
  );
  await admin.unsafe(
    source(
      "supabase/migrations/20261109231834_commercial_lifetime_supply_guards.sql",
    ),
  );
  const bridge =
    "supabase/migrations/20261115043326_founder_credit_pack_lifetime_bridge.sql";
  await admin.unsafe(
    actualFunction(bridge, "commercial_billing.supply_balanced"),
  );
  await admin.unsafe(
    actualFunction(bridge, "beta_packs.prevent_serial_collision"),
  );
  await admin.unsafe(
    "create trigger beta_serial_collision before insert on commercial_billing.cards for each row execute function beta_packs.prevent_serial_collision(); alter table commercial_billing.control add column gameplay_enabled boolean not null default false",
  );
  // Install the real current auth/session/phone functions against minimal fixture tables.
  await admin.unsafe(
    "create function launch_transition.identity_allowed(u uuid) returns boolean language sql as $$select u is not null$$",
  );
  const transition =
    "supabase/migrations/20261117001019_clean_commercial_account_transition.sql";
  await admin.unsafe(
    actualFunction(transition, "private.active_member_session"),
  );
  await admin.unsafe(
    actualFunction(transition, "private.public_phone_verified"),
  );
  await admin.unsafe(
    source("supabase/migrations/20261117091440_public_owner_support.sql"),
  );
  await admin.unsafe(
    source("supabase/migrations/20261121021000_owner_commercial_summary.sql"),
  );
  await admin.unsafe(source(migration));
  const password = randomBytes(32).toString("hex");
  await admin.unsafe(
    `create role award_fixture_runtime login nosuperuser nobypassrls password '${password}';grant docked_commercial_app to award_fixture_runtime`,
  );
  const runtimeUrl = new URL(url);
  runtimeUrl.username = "award_fixture_runtime";
  runtimeUrl.password = password;
  runtime = postgres(runtimeUrl.href, { max: 12, onnotice: () => {} });
  ledger = new CommercialLedger(runtime, "acceptance", {
    active: "fixture",
    values: { fixture: randomBytes(32) },
  });
  const approvals = Object.fromEntries(
    [
      "owner",
      "legal",
      "googlePlay",
      "privacy",
      "retention",
      "refundRecovery",
      "playerRights",
      "supplyReconciliation",
    ].map((key) => [key, "ISOLATED LOOPBACK FIXTURE ONLY"]),
  );
  Object.assign(approvals, {
    validUntil: "2099-01-01T00:00:00Z",
    withdrawals: false,
    prizes: false,
    paidEntry: false,
    nba: false,
  });
  await admin`update commercial_billing.control set environment='acceptance',policy_version=${commercialPolicyVersion},issuance_enabled=true,sales_enabled=true,approvals=${admin.json(approvals)}`;
  await admin`update commercial_billing.products set approved=true`;
  await admin`insert into private.region_policies(country,state,effective_from,effective_to,preview_community_only,approved,minimum_age,review_at) values('AU','NSW',clock_timestamp()-interval '1 day',clock_timestamp()+interval '1 year',false,true,18,clock_timestamp()+interval '1 year')`;
  await identity(owner, "owner", ownerSession);
  await identity(recipient);
  await identity(other);
  await definitions("nfl");
  await definitions("nrl", true);
  // Preserve the exact feed identity constraints without loading unrelated
  // fixtures, scoring, or beta ingestion infrastructure.
  await admin.unsafe("create schema sports_feed");
  await admin.unsafe(
    actualFunction(
      "supabase/migrations/20261010231416_nfl_postgame_isolated_feed.sql",
      "sports_feed.immutable",
    ),
  );
  const feedRegistry = source(
    "supabase/migrations/20261022010531_multi_sport_readiness_registry.sql",
  );
  for (const table of ["player_identities", "player_aliases"]) {
    const start = feedRegistry.indexOf(`create table sports_feed.${table} (`);
    assert(start >= 0);
    const end = feedRegistry.indexOf("\n);", start);
    assert(end > start);
    await admin.unsafe(feedRegistry.slice(start, end + 3));
    await admin.unsafe(
      `alter table sports_feed.${table} enable row level security;revoke all on sports_feed.${table} from public,anon,authenticated,docked_app,docked_beta_app;create trigger immutable before update or delete on sports_feed.${table} for each row execute function sports_feed.immutable()`,
    );
  }
  const preserved = await fingerprint();
  const rosterMigration = source(
    "supabase/migrations/20261122011302_commercial_player_roster.sql",
  );
  testedRosterMigrationHash = createHash("sha256")
    .update(rosterMigration)
    .digest("hex");
  await admin.unsafe(rosterMigration).catch((error) => {
    const position = Number(error.position ?? error.internal_position ?? 0);
    console.error("Roster migration parse context", {
      position,
      nearby: rosterMigration.slice(
        Math.max(0, position - 350),
        position + 350,
      ),
    });
    throw error;
  });
  assert.deepEqual(await fingerprint(), preserved);
}

async function main() {
  await bootstrap();
  let first: Awaited<ReturnType<typeof award>>;
  await check(
    "exact mixed award creates two sealed packs and ten permanent cards without monetary mutation",
    async () => {
      const before = await fingerprint(true);
      first = await award();
      assert.equal(first.packs.length, 2);
      assert.equal(
        first.packs.reduce((n, pack) => n + pack.size, 0),
        10,
      );
      const rows =
        await admin`select p.price,p.funding,p.opened_at,p.product,count(c.id)::int cards from commercial_billing.packs p join commercial_billing.cards c on c.pack=p.id where p.award_id=${first.id} group by p.id`;
      assert.equal(rows.length, 2);
      for (const row of rows) {
        assert.equal(Number(row.price), 0);
        assert.deepEqual(row.funding, []);
        assert.equal(row.opened_at, null);
        assert.equal(row.cards, row.product.cards);
      }
      assert.deepEqual(await fingerprint(true), before);
      assert.equal((await ledger.wallet(recipient)).balance, 0);
      assert.equal(
        (
          await admin`select count(*)::int n from auth.sessions where user_id=${recipient}`
        )[0].n,
        0,
      );
    },
  );
  await check(
    "all six options and repeated same-definition packs retain canonical sizes and sequential serials",
    async () => {
      const bundle = command({
        reason: "PRIZE",
        lines: (["STANDARD", "PREMIUM"] as const).flatMap((family) =>
          ([1, 3, 9] as const).map((size) => line("nfl", family, size)),
        ),
      });
      const result = await zeroDraw(() => award(bundle));
      assert.equal(result.packs.length, 6);
      assert.equal(
        result.packs.reduce((n, pack) => n + pack.size, 0),
        26,
      );
      const repeated = await zeroDraw(() =>
        award(command({ lines: [line("nfl", "STANDARD", 1, 3)] })),
      );
      const serials =
        await admin`select c.definition,c.serial from commercial_billing.cards c join commercial_billing.packs p on p.id=c.pack where p.award_id=${repeated.id} order by c.serial`;
      assert.equal(new Set(serials.map((row) => row.definition)).size, 1);
      assert.deepEqual(
        serials.map((row) => row.serial),
        [serials[0].serial, serials[0].serial + 1, serials[0].serial + 2],
      );
    },
  );
  await check(
    "concurrent retries and reordered exact commands recover one immutable receipt",
    async () => {
      const input = command();
      const [left, right] = await Promise.all([
        award(input),
        award({ ...input, lines: [...input.lines].reverse() }),
      ]);
      assert.deepEqual(left, right);
      assert.equal(
        (
          await admin`select count(*)::int n from commercial_billing.pack_awards where actor=${owner} and request=${input.request}`
        )[0].n,
        1,
      );
      const before = await fingerprint();
      for (const changed of [
        { ...input, member: other },
        { ...input, reason: "PRIZE" as const },
        { ...input, reference: "Different campaign" },
        { ...input, lines: [line("nfl", "STANDARD", 1)] },
      ])
        await assert.rejects(award(changed));
      assert.deepEqual(await fingerprint(), before);
    },
  );
  await check(
    "later unavailable pack rolls back all earlier pack/card/account allocation",
    async () => {
      const before = await fingerprint();
      await assert.rejects(
        award(
          command({
            lines: [line("nfl", "STANDARD", 1), line("nrl", "STANDARD", 9)],
          }),
        ),
        /supply|available/i,
      );
      assert.deepEqual(await fingerprint(), before);
    },
  );
  await check(
    "current owner role, session, MFA and bound actor are rechecked inside the transaction",
    async () => {
      const before = await fingerprint();
      await assert.rejects(
        award(command(), owner, authorise(owner, ownerSession, "aal1")),
        /MFA|Owner|owner/,
      );
      await assert.rejects(
        award(command(), owner, authorise(owner, randomUUID())),
        /MFA|Owner|owner/,
      );
      await assert.rejects(
        award(command(), other, authorise()),
        /Owner|owner|actor/,
      );
      await admin`update private.roles set role='admin' where user_id=${owner}`;
      await assert.rejects(award(), /MFA|Owner|owner/);
      await admin`update private.roles set role='owner' where user_id=${owner}`;
      await admin`update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=${ownerSession}`;
      await assert.rejects(award(), /MFA|Owner|owner/);
      await admin`update auth.sessions set not_after=clock_timestamp()+interval '1 day' where id=${ownerSession}`;
      assert.deepEqual(await fingerprint(), before);
    },
  );
  await check(
    "recipient restriction, consent withdrawal, phone loss, retirement and financial holds reject issuance",
    async () => {
      const target = randomUUID();
      await identity(target);
      const receipt = await funded(target);
      const input = command({ member: target });
      const before = await fingerprint();
      await admin`insert into private.owner_customer_restrictions(user_id,restricted_at) values(${target},clock_timestamp())`;
      await assert.rejects(award(input));
      await admin`delete from private.owner_customer_restrictions where user_id=${target}`;
      await admin`update private.consent_events set granted=false where user_id=${target}`;
      await assert.rejects(award(input));
      await admin`update private.consent_events set granted=true where user_id=${target}`;
      await admin`update auth.users set phone_confirmed_at=null where id=${target}`;
      await assert.rejects(award(input));
      await admin`update auth.users set phone_confirmed_at=clock_timestamp() where id=${target}`;
      await admin`insert into launch_transition.accounts(user_id,kind) values(${target},'customer')`;
      await assert.rejects(award(input));
      await admin`delete from launch_transition.accounts where user_id=${target}`;
      assert.deepEqual(await fingerprint(), before);
      await admin`insert into commercial_billing.recovery_cases(id,receipt,member_id,exposure_credits,reason) values(${receipt.key},${receipt.key},${target},1,'Isolated hold')`;
      const held = await fingerprint();
      await assert.rejects(award(input));
      assert.deepEqual(await fingerprint(), held);
    },
  );
  await check(
    "member sees free provenance and existing opening/replay reveals without another issuance",
    async () => {
      const view = await new CommercialMemberView(
        ledger,
        recipient,
        noAuthorisation,
      ).packs();
      const pack = first!.packs[0];
      const visible = view.packs.find((row) => row.id === pack.id);
      assert(visible);
      assert.equal(visible.paidCredits, 0);
      assert.equal(visible.status, "SEALED");
      assert.deepEqual(visible.award, { id: first!.id, reason: "PROMOTION" });
      assert(!JSON.stringify(visible).includes("Isolated launch promotion"));
      const before = (
        await admin`select count(*)::int n from commercial_billing.cards`
      )[0].n;
      const opened = await ledger.openPack(recipient, pack.id, noAuthorisation);
      const replay = await ledger.openPack(recipient, pack.id, noAuthorisation);
      assert.deepEqual(opened, replay);
      assert.equal(opened.cards.length, pack.size);
      assert.equal(
        (await admin`select count(*)::int n from commercial_billing.cards`)[0]
          .n,
        before,
      );
      await assert.rejects(
        ledger.openPack(other, pack.id, noAuthorisation),
        /not found/i,
      );
    },
  );
  await check(
    "normal paid purchase still charges once, records funding and opens the same allocated cards",
    async () => {
      const customer = randomUUID();
      await identity(customer);
      const receipt = await funded(customer);
      const product = commercialPack("nfl", "PREMIUM", 3);
      const request = randomUUID();
      const input = { ...line("nfl", "PREMIUM", 3), confirmed: true as const };
      const before = await ledger.wallet(customer);
      const bought = await ledger.buyPack(
        customer,
        request,
        input,
        noAuthorisation,
      );
      assert.equal(bought.price, product.priceCredits);
      assert.equal(
        (await ledger.wallet(customer)).balance,
        before.balance - product.priceCredits,
      );
      const replay = await ledger.buyPack(
        customer,
        request,
        input,
        noAuthorisation,
      );
      assert.deepEqual(replay, bought);
      assert.equal(
        (await ledger.wallet(customer)).balance,
        before.balance - product.priceCredits,
      );
      const [pack] =
        await admin`select price,award_id,funding from commercial_billing.packs where id=${bought.id}`;
      assert.equal(pack.award_id, null);
      assert.equal(Number(pack.price), product.priceCredits);
      assert.equal(pack.funding.length, 1);
      assert.equal(pack.funding[0].receipt, receipt.key);
      assert.equal(pack.funding[0].amount, product.priceCredits);
      const [journal] =
        await admin`select sum(amount)::text total,count(*)::int lines from commercial_billing.lines where journal=${`pack:${bought.id}`}`;
      assert.deepEqual(journal, { total: "0", lines: 2 });
      const beforeOpen = await fingerprint(true);
      const opened = await ledger.openPack(
        customer,
        bought.id,
        noAuthorisation,
      );
      assert.equal(opened.cards.length, 3);
      assert.deepEqual(
        await ledger.openPack(customer, bought.id, noAuthorisation),
        opened,
      );
      assert.deepEqual(await fingerprint(true), beforeOpen);
      const revocation = {
        ...receipt,
        state: "REVOKED" as const,
        refundedCents: receipt.grossCents!,
        providerAt: new Date().toISOString(),
      };
      const countBeforeRefund = (
        await admin`select count(*)::int n from commercial_billing.cards`
      )[0].n;
      await ledger.accept(
        revocation,
        customer,
        fixtureTokens.get(receipt.key)!,
        noAuthorisation,
      );
      assert.equal((await ledger.wallet(customer)).balance, 0);
      const [hold] =
        await admin`select exposure_credits,state from commercial_billing.recovery_cases where receipt=${receipt.key}`;
      assert.equal(Number(hold.exposure_credits), product.priceCredits);
      assert.equal(hold.state, "OPEN");
      assert.equal(
        (await admin`select count(*)::int n from commercial_billing.cards`)[0]
          .n,
        countBeforeRefund,
      );
      assert.deepEqual(
        await ledger.openPack(customer, bought.id, noAuthorisation),
        opened,
      );
      const afterRefund = await fingerprint(true);
      delete afterRefund.receipts; // Re-observation may refresh provider checked-at metadata.
      await ledger.accept(
        revocation,
        customer,
        fixtureTokens.get(receipt.key)!,
        noAuthorisation,
      );
      const refundReplay = await fingerprint(true);
      delete refundReplay.receipts;
      assert.deepEqual(refundReplay, afterRefund);
    },
  );
  await check(
    "concurrent purchased and free packs cannot oversell the final serial",
    async () => {
      await funded(other);
      const before = (
        await admin`select count(*)::int n from commercial_billing.packs where product->>'sport'='nrl'`
      )[0].n;
      const result = await zeroDraw(() =>
        Promise.allSettled([
          award(command({ lines: [line("nrl", "STANDARD", 1)] })),
          ledger.buyPack(
            other,
            randomUUID(),
            { ...line("nrl", "STANDARD", 1), confirmed: true },
            noAuthorisation,
          ),
        ]),
      );
      assert.equal(
        result.filter((row) => row.status === "fulfilled").length,
        1,
      );
      assert.equal(
        (
          await admin`select count(*)::int n from commercial_billing.packs where product->>'sport'='nrl'`
        )[0].n,
        before + 1,
      );
    },
  );
  await check(
    "global issuance stop rejects new awards and leaves the committed audit intact",
    async () => {
      await admin`update commercial_billing.control set issuance_enabled=false`;
      const before = await fingerprint();
      await assert.rejects(award(), /disabled|unavailable/i);
      assert.deepEqual(await fingerprint(), before);
      await admin`update commercial_billing.control set issuance_enabled=true`;
    },
  );
  await check(
    "stale product review and direct orphan or incomplete awards cannot bypass allocation guards",
    async () => {
      const before = await fingerprint();
      await assert.rejects(
        award(
          command({
            lines: [
              {
                ...line("nfl", "STANDARD", 1),
                configurationHash: "0".repeat(64),
              },
            ],
          }),
        ),
        /changed|review/i,
      );
      const product = commercialPack("nfl", "STANDARD", 1);
      await assert.rejects(
        runtime`insert into commercial_billing.packs(member_id,request,product,price,funding,draw_evidence,policy_version) values(${recipient},${randomUUID()},${runtime.json(product)},0,'[]'::jsonb,'[]'::jsonb,${commercialPolicyVersion})`,
        /origin|check constraint/,
      );
      await assert.rejects(
        runtime.begin(async (raw) => {
          const tx = raw as unknown as Sql;
          await authorise()(tx);
          const input = command({ lines: [line("nfl", "STANDARD", 1)] });
          await tx`select commercial_billing.create_pack_award(${owner}::uuid,${tx.json(input)},${"1".repeat(64)},${tx.json([product])},${versions.terms},${versions.privacy})`;
        }),
        /allocated atomically/,
      );
      await assert.rejects(
        runtime.begin(async (raw) => {
          const tx = raw as unknown as Sql;
          await authorise()(tx);
          await tx`insert into commercial_billing.packs(member_id,request,product,price,funding,draw_evidence,policy_version,award_id,award_index) values(${recipient},${randomUUID()},${tx.json(product)},0,'[]'::jsonb,'[]'::jsonb,${commercialPolicyVersion},${first!.id},0)`;
        }),
        /current Owner pack award/,
      );
      assert.deepEqual(await fingerprint(), before);
    },
  );
  await check(
    "pack award audit cannot be edited, deleted or converted into a paid pack",
    async () => {
      await assert.rejects(
        admin`update commercial_billing.pack_awards set reference='Changed reference' where id=${first!.id}`,
        /immutable/i,
      );
      await assert.rejects(
        admin`delete from commercial_billing.pack_awards where id=${first!.id}`,
        /immutable/i,
      );
      await assert.rejects(
        admin`update commercial_billing.packs set price=100 where award_id=${first!.id}`,
        /immutable|award/i,
      );
      await assert.rejects(
        admin`truncate commercial_billing.pack_awards`,
        /immutable|referenc/i,
      );
    },
  );
  await check(
    "owner reports separate paid packs and retain member award history",
    async () => {
      const result = await admin.begin(async (raw) => {
        const tx = raw as unknown as Sql;
        await authorise()(tx);
        const [report] =
          await tx`select private.owner_command_centre(clock_timestamp()-interval '1 day',clock_timestamp()+interval '1 day') value`;
        const [detail] =
          await tx`select private.admin_record_detail('members',${recipient}) value`;
        return { report: report.value, detail: detail.value };
      });
      const [counts] =
        await admin`select count(*) filter(where award_id is null)::int paid,count(*) filter(where award_id is not null)::int awarded from commercial_billing.packs`;
      assert.equal(result.report.metrics.paidPacks, counts.paid);
      assert(counts.awarded > 0);
      assert(JSON.stringify(result.detail.history).includes("award"));
    },
  );
  await check(
    "restricted runtime has no new financial or direct award-table write authority",
    async () => {
      const [rights] =
        await runtime`select has_table_privilege(current_user,'commercial_billing.pack_awards','INSERT') can_insert,has_table_privilege(current_user,'commercial_billing.pack_awards','UPDATE') can_update,has_table_privilege(current_user,'commercial_billing.pack_awards','DELETE') can_delete`;
      assert.equal(rights.can_insert, false);
      assert.equal(rights.can_update, false);
      assert.equal(rights.can_delete, false);
      await assert.rejects(
        admin.begin(async (raw) => {
          const tx = raw as unknown as Sql;
          await tx`set local role authenticated`;
          await tx`select commercial_billing.pack_award_actor(${owner}::uuid)`;
        }),
        /permission denied/,
      );
    },
  );
  await check(
    "local catalogue audit confirms RLS, pinned definer search paths and no public execution",
    async () => {
      const [table] =
        await admin`select relrowsecurity from pg_class where oid='commercial_billing.pack_awards'::regclass`;
      assert.equal(table.relrowsecurity, true);
      const functions =
        await admin`select p.proname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') service,has_function_privilege('docked_app',p.oid,'EXECUTE') general_app from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='commercial_billing' and p.proname in('pack_award_actor','pack_award_recipient','create_pack_award','pack_award_pack_guard','pack_award_complete') order by p.proname`;
      assert.equal(functions.length, 5);
      for (const fn of functions) {
        assert.equal(fn.prosecdef, true);
        assert(
          fn.proconfig.some((setting: string) =>
            /^search_path=(?:""|)$/.test(setting),
          ),
        );
        for (const role of ["anon", "authenticated", "service", "general_app"])
          assert.equal(
            fn[role],
            false,
            `${role} must not execute ${fn.proname}`,
          );
      }
      const [role] =
        await runtime`select rolsuper,rolbypassrls from pg_roles where rolname=current_user`;
      assert.equal(role.rolsuper, false);
      assert.equal(role.rolbypassrls, false);
    },
  );
  await currentRosterPostgresChecks({
    admin,
    runtime,
    ledger,
    owner,
    ownerSession,
    recipient,
    other,
    versions,
    authorise,
    identity,
    funded,
    fingerprint,
    check,
    zeroDraw,
    award,
    command,
    line,
    noAuthorisation,
  });
  const [integrity] =
    await admin`select (select count(*) from commercial_billing.definitions d where d.issued<>d.legacy_issued+(select count(*) from commercial_billing.cards c where c.definition=d.id)+(select count(*) from beta_packs.issued b where b.definition=d.id))::int supply_mismatch,(select count(*) from(select definition,serial from commercial_billing.cards group by definition,serial having count(*)>1)s)::int duplicate_serial,(select count(*) from commercial_billing.packs p where (select count(*) from commercial_billing.cards c where c.pack=p.id)<>(p.product->>'cards')::int)::int incomplete_pack`;
  assert.deepEqual(integrity, {
    supply_mismatch: 0,
    duplicate_serial: 0,
    incomplete_pack: 0,
  });
  const directory =
    process.env.DOCKED_DB_TEST_REPORT_DIR ?? "docs/qa/current-rosters-20261122";
  mkdirSync(directory, { recursive: true });
  // Run the installed Supabase security advisor against this disposable native
  // database. Never log the fixture connection string or password.
  const advisorUrl = new URL(url);
  advisorUrl.searchParams.set("sslmode", "disable"); // Loopback fixture has no TLS.
  const advisor = spawnSync(
    "node_modules/.bin/supabase",
    [
      "db",
      "advisors",
      "--db-url",
      advisorUrl.href,
      "--type",
      "security",
      "--level",
      "warn",
      "--fail-on",
      "error",
    ],
    { encoding: "utf8", timeout: 15_000, maxBuffer: 2_000_000 },
  );
  const advisorOutput = `${advisor.stdout ?? ""}\n${advisor.stderr ?? ""}`
    .replaceAll(advisorUrl.href, "[LOOPBACK DATABASE]")
    .replaceAll(url.href, "[LOOPBACK DATABASE]")
    .replaceAll(url.password, "[REDACTED]")
    .slice(0, 10_000);
  writeFileSync(
    `${directory}/ADVISORS.json`,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        scope: "Disposable loopback PostgreSQL fixture only",
        exitCode: advisor.status,
        signal: advisor.signal,
        errorCode:
          advisor.error && "code" in advisor.error ? advisor.error.code : null,
        output: advisorOutput,
        catalogueFallback:
          "Actual RLS/ACL/definer search-path checks passed in DATABASE.json; no hosted advisor run",
      },
      null,
      2,
    ) + "\n",
  );
  const result = {
    at: new Date().toISOString(),
    runtime: "native PostgreSQL 17.10; loopback only",
    rosterMigration: {
      path: "supabase/migrations/20261122011302_commercial_player_roster.sql",
      sha256: testedRosterMigrationHash,
    },
    checks,
    integrity,
    fixtureOnly: true,
    productionWrites: 0,
    customerAwards: 0,
    realPayments: 0,
  };
  writeFileSync(
    `${directory}/DATABASE.json`,
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    `PASS ${checks.length} isolated PostgreSQL checks; zero integrity discrepancies`,
  );
  console.log(
    `Supabase fixture advisor exit: ${advisor.status ?? advisor.signal ?? "unavailable"}; see ADVISORS.json`,
  );
}
void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await runtime?.end();
    await admin.end();
  });
