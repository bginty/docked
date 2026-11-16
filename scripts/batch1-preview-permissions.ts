/** Compile a reviewed, disposable namespace permission package. No remote writes. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  packAcceptanceSchemas,
  packAcceptanceStatement,
} from "../src/server/pack-acceptance-sql";
const dir = "private-data/batch1-hosted-20261116",
  out = "docs/qa/batch1-hosted-20261116";
const closure = JSON.parse(
  readFileSync(out + "/dependency-closure.json", "utf8"),
);
const selected = new Set(closure.objects);
const tables = JSON.parse(
  readFileSync(out + "/production-readonly.json", "utf8"),
).tables;
const functions = JSON.parse(
  readFileSync(
    "docs/qa/batch1-controlled-20261116/production-readonly.json",
    "utf8",
  ),
).functions;
const fixture = JSON.parse(readFileSync(dir + "/fixtures.json", "utf8"));
const members = fixture.accounts
  .map((a: any) => {
    assert.match(a.id, /^[a-f0-9-]{36}$/);
    return `'${a.id}'::uuid`;
  })
  .join(",");
const role = "docked_pack_acceptance",
  owner = "docked_pack_acceptance_owner";
const names = packAcceptanceSchemas.map((s) => "b1_" + s);
const grants: string[] = [];
for (const t of tables) {
  if (!selected.has(t.schema + "." + t.name)) continue;
  const acl = (t.acl ?? []).find((s: string) =>
    s.startsWith("docked_beta_app="),
  );
  if (!acl) continue;
  const rights = acl.split("=")[1].split("/")[0];
  const key: Record<string, string> = {
    r: "select",
    w: "update",
    a: "insert",
    d: "delete",
    U: "usage",
  };
  assert(
    [...rights].every((c) => key[c]),
    "Unexpected original table privilege",
  );
  grants.push(
    `grant ${[...rights].map((c) => key[c]).join(",")} on ${t.kind === "S" ? "sequence" : "table"} b1_${t.schema}.${t.name} to ${role};`,
  );
}
for (const f of functions) {
  if (!selected.has(f.signature.split("(")[0])) continue;
  const granted = (f.proacl ?? []).some((s: string) =>
    s.startsWith("docked_beta_app=X/"),
  );
  if (granted)
    grants.push(
      `grant execute on function ${packAcceptanceStatement(f.signature)} to ${role};`,
    );
}
// Auth tables are read only through fixed-member filtered views. These expose no
// other Preview accounts, sessions or MFA factors to the namespace owner/runtime.
let sql = `create role ${owner} nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
alter role ${role} nosuperuser nocreatedb nocreaterole noinherit nobypassrls connection limit 12;
alter role ${role} set statement_timeout='25s'; alter role ${role} set idle_in_transaction_session_timeout='15s';
create table b1_acceptance.window(id boolean primary key default true check(id), starts timestamptz not null, expires timestamptz not null, check(expires>starts and expires-starts<=interval '24 hours'));
insert into b1_acceptance.window values(true,now(),now()+interval '24 hours');
create table b1_acceptance.members(id uuid primary key); insert into b1_acceptance.members select unnest(array[${members}]);
revoke all on all tables in schema b1_acceptance from public,anon,authenticated,service_role;
`;
for (const [table, column] of [
  ["users", "id"],
  ["sessions", "user_id"],
  ["mfa_factors", "user_id"],
])
  sql += `create or replace view b1_acceptance.auth_${table} as select a.* from auth.${table} a where a.${column}=any(array[${members}]) and exists(select 1 from b1_acceptance.window w where w.starts<=now() and w.expires>now()); revoke all on b1_acceptance.auth_${table} from public,anon,authenticated,service_role; grant select on b1_acceptance.auth_${table} to ${owner};\n`;
sql += `grant usage on schema b1_acceptance to ${owner},${role}; grant execute on function b1_acceptance.uid(),b1_acceptance.jwt() to ${owner},${role}; grant select on b1_acceptance.window,b1_acceptance.members to ${owner};\n`;
// All definer functions run as this NOLOGIN owner of disposable objects only.
// Its Auth visibility is restricted to the two synthetic accounts above.
sql += `do $do$ declare r record;begin
 for r in select n.nspname,c.relname,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=any(array[${names.map((s) => `'${s}'`).join(",")}]) and c.relkind in('r','p','v','S') loop
 execute format('alter %s %I.%I owner to ${owner}',case r.relkind when 'v' then 'view' when 'S' then 'sequence' else 'table' end,r.nspname,r.relname);end loop;
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=any(array[${names.map((s) => `'${s}'`).join(",")}]) and p.prokind='f' loop execute format('alter function %s owner to ${owner}',r.signature);end loop;
end $do$;
${names.map((s) => `alter schema ${s} owner to ${owner}; grant usage on schema ${s} to ${role};`).join("\n")}
${grants.join("\n")}
`;
sql += `create function b1_acceptance.require_session() returns trigger language plpgsql security definer set search_path='' as $guard$
begin
 if coalesce(b1_acceptance.jwt()->>'aal','')<>'aal2' or not exists(
 select 1 from b1_acceptance.auth_users u join b1_acceptance.auth_sessions s on s.user_id=u.id
 where u.id=b1_acceptance.uid() and s.id::text=b1_acceptance.jwt()->>'session_id' and s.aal='aal2'
 and (s.not_after is null or s.not_after>now()) and u.email_confirmed_at is not null
 and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now())
 and u.raw_app_meta_data->>'docked_acceptance'='batch1-hosted-20261116'
 and exists(select 1 from b1_acceptance.auth_mfa_factors f where f.user_id=u.id and f.status='verified'))
 then raise exception 'Active synthetic AAL2 session and acceptance window required';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $guard$;
revoke all on function b1_acceptance.require_session() from public,anon,authenticated,service_role;
alter function b1_acceptance.require_session() owner to ${owner};
create trigger acceptance_session before update on b1_credits_sandbox.state for each row execute function b1_acceptance.require_session();
create trigger acceptance_session before insert on b1_beta_fantasy.cards for each row execute function b1_acceptance.require_session();
create trigger acceptance_session before insert or update on b1_sports_feed.sport_sandbox_inventory for each row execute function b1_acceptance.require_session();
`;
writeFileSync(dir + "/namespace-permissions.sql", sql);
writeFileSync(
  out + "/preview-permissions.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      runtime: role,
      owner,
      ownerLogin: false,
      privilegedMemberships: [],
      authScope: "two synthetic UUIDs only",
      grants,
      sha256: createHash("sha256").update(sql).digest("hex"),
      hostedChanges: 0,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({ grants: grants.length, authAccounts: 2, hostedWrites: 0 }),
);
