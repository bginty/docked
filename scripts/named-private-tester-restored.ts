/** Disconnect-only rehearsal. Cannot accept a hosted URL or another container. */
import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import {
  namedTesterActivationSql,
  namedTesterDirectory,
  namedTesterId as member,
  namedTesterMigration,
} from "./lib/named-tester-plan";
import { namedTesterNoticeVersion } from "../src/core/named-private-tester";
import {
  tableListQuery,
  checksumQuery,
  custodyQuery,
} from "./lib/reviewed-inventory";
import { executeCredits, wallet } from "../src/core/credits-sandbox";
import { founderCreditCommand } from "../src/core/founder-credits";
import { digest } from "../src/core/scoring-engine";
import { verifyNamedTesterFixtureAudit } from "./lib/named-tester-fixture-audit";

async function main() {
  const target = "docked-commercial-restore-20261115l";
  const cfg = JSON.parse(
    execFileSync("docker", ["inspect", target], {
      windowsHide: true,
    }).toString(),
  )[0];
  assert.equal(cfg.HostConfig.NetworkMode, "none");
  assert.equal(Object.keys(cfg.HostConfig.PortBindings ?? {}).length, 0);
  const backup = JSON.parse(
    readFileSync(
      "docs/qa/v31-prelaunch-execution-20261111/database/restore-20261115l/restore-only.json",
      "utf8",
    ),
  );
  assert.equal(backup.restored, true);
  assert.equal(backup.protectedRecordsUnchanged, true);
  const args = [
    "exec",
    "-i",
    target,
    "psql",
    "-X",
    "-q",
    "-h",
    "/restore",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
  ];
  mkdirSync(namedTesterDirectory, { recursive: true });
  mkdirSync("private-data/brenton-private-tester-20261115", {
    recursive: true,
  });
  function run(sql: string): string {
    try {
      return execFileSync("docker", args, {
        input: sql,
        windowsHide: true,
        maxBuffer: 256e6,
        stdio: ["pipe", "pipe", "pipe"],
      }).toString();
    } catch (e) {
      writeFileSync(
        "private-data/brenton-private-tester-20261115/local-sql-error.txt",
        String((e as { stderr?: Buffer }).stderr ?? "Unknown SQL failure"),
      );
      throw Error(
        "Disconnected SQL check failed; inspect private local-sql-error.txt",
      );
    }
  }
  function values(sql: string): any[] {
    return run(sql)
      .split(/\r?\n/)
      .filter((l) => l.startsWith("{") || l.startsWith("["))
      .map((l) => JSON.parse(l));
  }
  const lit = (s: string) => "'" + s.replaceAll("'", "''") + "'";
  const json = (s: unknown) => lit(JSON.stringify(s)) + "::jsonb";
  const checks: string[] = [];
  function passed(s: string) {
    checks.push(s);
    console.log("PASS " + s);
  }
  function rejects(sql: string) {
    let failed = false;
    try {
      run(sql);
    } catch {
      failed = true;
    }
    assert(failed, "Expected database denial");
  }
  const claims = (user: string, session: string, aal = "aal1") =>
    `select set_config('request.jwt.claim.sub',${lit(user)},true),set_config('request.jwt.claims',${json({ sub: user, session_id: session, aal })}::text,true);`;
  const migration = readFileSync(namedTesterMigration, "utf8");
  if (
    !values(
      "select jsonb_build_object('present',to_regclass('beta_packs.members') is not null)",
    )[0].present
  ) {
    const dependency = readFileSync(
      "supabase/migrations/20261115043326_founder_credit_pack_lifetime_bridge.sql",
      "utf8",
    );
    const adoption = readFileSync(
      "private-data/founder-credit-packs-20261115/adopt.private.sql",
      "utf8",
    );
    const approved = JSON.parse(
      readFileSync(
        "docs/qa/founder-credit-packs-20261115/proposal.json",
        "utf8",
      ),
    );
    assert.equal(
      createHash("sha256").update(dependency).digest("hex"),
      "27438d7517eb90e5399f5d66f780ee1ee8dec195906a8bc2768217fe38938209",
    );
    assert.equal(
      createHash("sha256").update(adoption).digest("hex"),
      approved.adoptionSha256,
    );
    run(
      "begin;set local statement_timeout='120s';" +
        dependency +
        "\n" +
        adoption +
        "commit;",
    );
    passed(
      "Existing approved pack dependency reconstructed on the older disconnected snapshot only",
    );
  }
  const [tables] = values(tableListQuery);
  const census = () =>
    values(
      "begin isolation level repeatable read read only;" +
        tables.map(checksumQuery).join(";") +
        ";commit;",
    );
  const before = census();
  run("begin;set local lock_timeout='3s';" + migration + "rollback;");
  assert.equal(
    values(
      "select jsonb_build_object('absent',to_regclass('beta_private.named_tester_exception') is null)",
    )[0].absent,
    true,
  );
  run("begin;set local lock_timeout='3s';" + migration + "commit;");
  assert.equal(digest(census()), digest(before));
  passed("Migration commit and rollback preserve every original table row");
  assert.equal(
    values(
      `select jsonb_build_object('setup',beta_private.named_tester_setup_identity(${lit(member)}::uuid),'admitted',beta_private.admitted(${lit(member)}::uuid))`,
    )[0].setup,
    false,
  );
  const existingMembers = values(
    "select jsonb_agg(jsonb_build_object('id',member_id,'allowed',beta_packs.member_allowed(member_id)) order by member_id) from beta_packs.members",
  )[0];
  const protectedCapture = () =>
    values(
      "begin isolation level repeatable read read only;" +
        tables
          .map((t: string) => {
            if (t === "beta_private.admission_control")
              return "select jsonb_build_object('table','beta_private.admission_control','hash',md5((to_jsonb(t)-'admission_revision')::text)) from beta_private.admission_control t";
            if (
              [
                "credits_sandbox.state",
                "credits_sandbox.journal",
                "credits_sandbox.lines",
                "credits_sandbox.history",
              ].includes(t)
            )
              return checksumQuery(t);
            return checksumQuery(t).replace(
              `from ${t} t)q`,
              `from ${t} t where position('${member}' in to_jsonb(t)::text)=0
               and not exists(select 1 from beta_private.admissions a where a.user_id='${member}'::uuid and position(a.id::text in to_jsonb(t)::text)>0)
               and not exists(select 1 from beta_private.social_profiles p where p.user_id='${member}'::uuid and position(p.id::text in to_jsonb(t)::text)>0))q`,
            );
          })
          .join(";") +
        ";" +
        custodyQuery +
        ";commit;",
    );
  const protectedBefore = protectedCapture();
  const originalAudit = values(
    `select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]') from beta_private.admission_events e join beta_private.admissions a on a.id=e.admission_id where a.user_id='${member}'::uuid`,
  )[0];
  writeFileSync(
    "private-data/brenton-private-tester-20261115/protected-baseline.private.json",
    JSON.stringify({ protectedBefore, originalAudit }),
  );
  // Recreate the separately deployed, existing private-pack controls in this older snapshot.
  run(
    "update beta_packs.control set enabled=true,grants_enabled=true,authority_reference='Disconnected replay of existing approved private pack controls';",
  );
  const activation = namedTesterActivationSql(
    "Disconnected founder-approved named US tester fixture; no hosted action",
  );
  run("begin;" + activation + "commit;");
  rejects("begin;" + activation + "commit;");
  passed(
    "Preparation is one-account only, does not admit or record consent, and refuses accidental replay",
  );
  const anonymousSession = randomUUID(),
    session = randomUUID();
  assert.equal(
    values(
      `select jsonb_build_object('allowed',beta_private.named_tester_setup_identity(${lit(member)}::uuid))`,
    )[0].allowed,
    false,
  );
  run(`begin;update auth.users set email_confirmed_at=clock_timestamp(),raw_app_meta_data=coalesce(raw_app_meta_data,'{}')||'{"email_ownership_verified":false}'::jsonb where id=${lit(member)}::uuid;
insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(${lit(session)}::uuid,${lit(member)}::uuid,now(),now(),'aal1');commit;`);
  assert.equal(
    values(
      `select jsonb_build_object('allowed',beta_private.named_tester_setup_identity(${lit(member)}::uuid),'admitted',beta_private.admitted(${lit(member)}::uuid))`,
    )[0].allowed,
    true,
  );
  const [control] = values(
    "select to_jsonb(c) from beta_private.admission_control c where id",
  );
  const accept = (
    options: {
      user?: string;
      country?: string;
      state?: string;
      adult?: boolean;
      notice?: string;
      agreed?: boolean;
      sid?: string;
    } = {},
  ) =>
    `select beta_private.accept_named_tester(${lit(options.user ?? member)}::uuid,${lit(options.sid ?? session)}::uuid,${lit(options.country ?? "US")},${lit(options.state ?? "CA")},${options.adult ?? true},${json(control.policy_versions)},${lit(options.notice ?? namedTesterNoticeVersion)},${options.agreed ?? true});`;
  const own = `begin;set local role docked_beta_app;${claims(member, session)}`;
  for (const options of [
    { country: "AU", state: "NSW" },
    { state: "NY" },
    { adult: false },
    { notice: "old-notice" },
    { agreed: false },
    { sid: anonymousSession },
    { user: randomUUID() },
  ])
    rejects(own + accept(options) + "commit;");
  rejects(
    "begin;set local role docked_beta_app;" +
      claims(randomUUID(), session) +
      accept() +
      "commit;",
  );
  rejects(
    "begin;set local role authenticated;" +
      claims(member, session) +
      accept() +
      "commit;",
  );
  rejects(
    "begin;set local role docked_beta_app;update beta_private.named_tester_exception set enabled=true;commit;",
  );
  passed(
    "Wrong person, region, age, notice, session and public/direct-write privilege all denied",
  );
  run(
    "begin;update beta_private.named_tester_exception set enabled=false;" +
      `do $$begin if beta_private.named_tester_setup_identity(${lit(member)}::uuid) then raise exception 'Revocation denial failed';end if;end$$;rollback;`,
  );
  run(
    `begin;update auth.users set banned_until=now()+interval '1 day' where id=${lit(member)}::uuid;do $$begin if beta_private.named_tester_setup_identity(${lit(member)}::uuid) then raise exception 'Ban denial failed';end if;end$$;rollback;`,
  );
  // Both independent connections contend on the actual admission locks.
  await Promise.all(
    [0, 1].map(async () => {
      const child = execFile("docker", args, {
        windowsHide: true,
        maxBuffer: 2e6,
      });
      child.stdin!.end(own + accept() + "commit;");
      await new Promise<void>((resolve, reject) => {
        child.on("error", reject);
        child.on("exit", (code) =>
          code === 0
            ? resolve()
            : reject(Error("Concurrent acceptance failed")),
        );
      });
    }),
  );
  const [accepted] = values(
    `select jsonb_build_object('allowed',beta_private.admitted(${lit(member)}::uuid),'country',(select country from beta_private.admissions where user_id=${lit(member)}::uuid),'events',(select count(*) from beta_private.admission_events where action='named_tester_accepted' and actor=${lit(member)}))`,
  );
  assert.deepEqual(accepted, { allowed: true, country: "US", events: 1 });
  passed(
    "Two concurrent acceptances produce one immutable own-session US/CA acceptance",
  );
  run(
    own +
      `insert into beta_public.profiles(id,country,state,age_attested,accepted_version) values(${lit(member)}::uuid,'US','CA',true,${lit(control.policy_versions.terms)});
insert into beta_public.notification_preferences(user_id,digest,education,edge_alerts) values(${lit(member)}::uuid,'off',false,false);
insert into beta_private.social_profiles(user_id,handle,display_name) values(${lit(member)}::uuid,'brentonacceptance','BrentonAcceptance');
insert into beta_private.consent_events(user_id,purpose,granted,version,actor) select ${lit(member)}::uuid,purpose,true,${lit(control.policy_versions.terms)},${lit(member)} from unnest(array['terms','privacy','age_attestation']) purpose;
insert into beta_private.app_onboarding(user_id,interests)values(${lit(member)}::uuid,'both');
update beta_public.profiles set sports=array['nfl'],timezone='America/Los_Angeles',onboarding_completed_at=now() where id=${lit(member)}::uuid;commit;`,
  );
  rejects(
    own +
      `update beta_public.profiles set country='AU',state='NSW' where id=${lit(member)}::uuid;commit;`,
  );
  rejects(
    `begin;update beta_private.admission_events set action='changed' where action='named_tester_accepted' and actor=${lit(member)};commit;`,
  );
  passed(
    "Profile, display name and distinct consent records persist with California and audit history is immutable",
  );
  assert.equal(
    values(
      `select jsonb_build_object('allowed',beta_packs.member_allowed(${lit(member)}::uuid))`,
    )[0].allowed,
    true,
  );
  // The new exception must fail closed before any eventual public/commercial release.
  for (const change of [
    "update beta_private.named_tester_exception set enabled=false",
    "update beta_private.feature_flags set enabled=true where key='registration'",
  ])
    run(
      "begin;" +
        change +
        `;do $$begin if beta_packs.member_allowed(${lit(member)}::uuid) then raise exception 'Closed gate denial failed';end if;end$$;rollback;`,
    );
  rejects(own + `select beta_packs.assert_grant(${lit(member)}::uuid);commit;`);
  passed(
    "Revocation and public registration disable the exception; member cannot issue credits",
  );
  const [stateRow] = values(
    "select jsonb_build_object('revision',revision,'document',document) from credits_sandbox.state where id",
  );
  const [catalogue] = values("select beta_packs.catalogue()");
  const state = structuredClone(stateRow.document);
  state.economy.founderCatalogue = {
    enabled: true,
    players: Object.fromEntries(
      catalogue.players.map((p: any) => [
        p.legacyPlayer,
        { canonicalPlayer: p.canonicalPlayer, team: p.team },
      ]),
    ),
  };
  const [owner] = values(
    "select jsonb_build_object('id',u.id,'session',(select s.id from auth.sessions s where s.user_id=u.id and (s.not_after is null or s.not_after>now()) limit 1)) from auth.users u where lower(email)='support@docked.com.au'",
  );
  assert(owner?.id && owner?.session);
  assert.equal(wallet(state, member).available, 0);
  const grantRequest = randomUUID();
  const command = founderCreditCommand({
    request: grantRequest,
    member,
    amount: 100000,
    confirmed: true,
    reason: "Disconnected named tester free-credit rehearsal only",
  });
  const granted = executeCredits(
    state,
    { id: owner.id, role: "reviewer", aal: "aal2" },
    grantRequest,
    command,
    Date.now(),
  );
  assert.equal(wallet(granted.state, member).available, 100000);
  const replay = executeCredits(
    granted.state,
    { id: owner.id, role: "reviewer", aal: "aal2" },
    grantRequest,
    command,
    Date.now(),
  );
  assert.equal(digest(replay.state), digest(granted.state));
  let prior = stateRow.document,
    revision = Number(stateRow.revision),
    writes = "",
    current = granted.state;
  const steps: {
    state: any;
    request: string;
    actor: string;
    sid: string;
    aal: string;
  }[] = [
    {
      state: current,
      request: grantRequest,
      actor: owner.id,
      sid: owner.session,
      aal: "aal2",
    },
  ];
  let cost = 0;
  for (const type of ["STANDARD", "PREMIUM"]) {
    const product: any = Object.values(current.economy!.products).find(
      (p: any) =>
        p.sport === "nfl" &&
        p.type === type &&
        p.cards === 9 &&
        p.cataloguePolicy === "founder-credit-season-v1",
    );
    assert(product);
    assert.equal(product.cards, 9);
    cost += product.priceCredits;
    const request = randomUUID(),
      buy = {
        kind: "buy-pack",
        product: product.id,
        configuration: product.version,
        confirmed: true,
        policy: current.policy.version,
      };
    const result = executeCredits(
      current,
      { id: member, role: "member" },
      request,
      buy,
      Date.now(),
    );
    const again = executeCredits(
      result.state,
      { id: member, role: "member" },
      request,
      buy,
      Date.now(),
    );
    assert.equal(digest(again.state), digest(result.state));
    current = result.state;
    steps.push({
      state: current,
      request,
      actor: member,
      sid: session,
      aal: "aal1",
    });
  }
  assert.equal(wallet(current, member).available, 100000 - cost);
  for (const step of steps) {
    writes += claims(step.actor, step.sid, step.aal);
    if (step.actor === owner.id)
      writes += `select beta_packs.assert_grant(${lit(member)}::uuid);`;
    for (const j of step.state.journal.slice(prior.journal.length)) {
      writes += `insert into credits_sandbox.journal values(${lit(j.id)},${json(j)});`;
      for (const [i, l] of j.lines.entries())
        writes += `insert into credits_sandbox.lines values(${lit(j.id)},${i},${lit(l.account)},${l.credits});`;
    }
    revision++;
    writes += `insert into credits_sandbox.history(revision,actor,request,document)values(${revision},${lit(step.actor)},${lit(step.request)},${json(step.state)});update credits_sandbox.state set revision=${revision},document=${json(step.state)} where id;`;
    prior = step.state;
  }
  const [issued] = values(
    `begin;set local statement_timeout='120s';select pg_advisory_xact_lock(71820342);set local role docked_beta_app;${writes}set constraints all immediate;reset role;select jsonb_build_object('newCards',(select count(*) from beta_packs.issued),'issued',(select sum(issued) from commercial_billing.definitions),'legacy',(select sum(legacy_issued) from commercial_billing.definitions),'commercial',(select count(*) from commercial_billing.cards));rollback;`,
  );
  assert.deepEqual(issued, {
    newCards: 18,
    issued: 906,
    legacy: 888,
    commercial: 0,
  });
  assert.equal(
    digest(
      values(
        "select jsonb_build_object('revision',revision,'document',document) from credits_sandbox.state where id",
      )[0],
    ),
    digest(stateRow),
  );
  passed(
    "100,000 free credits, nine-card Standard and Premium packs, retries and lifetime supply verified; financial test rolled back",
  );
  const afterMembers = values(
    "select jsonb_agg(jsonb_build_object('id',member_id,'allowed',beta_packs.member_allowed(member_id)) order by member_id) from beta_packs.members where member_id<>" +
      lit(member) +
      "::uuid",
  )[0];
  assert.equal(digest(afterMembers), digest(existingMembers));
  // Only the deliberate local control activation differs outside this account.
  const protectedAfter = protectedCapture();
  const auditAfter = values(
    `select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]') from beta_private.admission_events e join beta_private.admissions a on a.id=e.admission_id where a.user_id='${member}'::uuid`,
  )[0];
  const originalAuditIds = new Set(originalAudit.map((e: any) => e.id));
  assert.equal(
    digest(auditAfter.filter((e: any) => originalAuditIds.has(e.id))),
    digest(originalAudit),
  );
  // The old snapshot needs one existing-control activation, with its immutable audit.
  verifyNamedTesterFixtureAudit(values, protectedBefore);
  const filter = (v: any[]) =>
    v.filter(
      (row) => !["beta_packs.control", "beta_packs.events"].includes(row.table),
    );
  const unexpected = filter(protectedAfter)
    .filter(
      (row: any, index: number) =>
        digest(row) !== digest(filter(protectedBefore)[index]),
    )
    .map((row: any) => row.table ?? "custody");
  writeFileSync(
    "private-data/brenton-private-tester-20261115/preservation-result.private.json",
    JSON.stringify({ unexpected }),
  );
  assert.deepEqual(unexpected, []);
  passed(
    "All existing members, unrelated records, balances, cards and custody remain unchanged",
  );
  const report = {
    at: new Date().toISOString(),
    passed: true,
    productionWrites: 0,
    network: "none",
    publishedPorts: 0,
    backupAt: backup.backupAt,
    sourceArchiveSha256: backup.archiveSha256,
    migrationSha256: createHash("sha256").update(migration).digest("hex"),
    originalTables: tables.length,
    originalDataPreservedByMigration: true,
    unrelatedRecordsPreserved: true,
    creditGrantAndPackTestRolledBack: true,
    hostedLoginOrConsentClaimed: false,
    checks,
  };
  writeFileSync(
    namedTesterDirectory + "restored-acceptance.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      passed: true,
      checks: checks.length,
      productionWrites: 0,
    }),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
