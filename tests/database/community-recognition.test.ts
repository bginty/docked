import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { RecognitionCandidate } from "../../src/core/community-recognition";

// Disposable SQL projection test only. No real database, Auth session or sporting record.
let pg: PGlite;
type RelationFragment = { relation: string };
type Tag = ((
  parts: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown[]>) & { unsafe: (relation: string) => RelationFragment };
let read: (
  tx: Tag,
  viewer: string | null,
  at: string,
) => Promise<RecognitionCandidate[]>;
const author = randomUUID(),
  authorUser = randomUUID(),
  viewer = randomUUID(),
  post = randomUUID(),
  edge = randomUUID();
const now = "2026-10-05T12:00:00Z";
const fragments = new WeakSet<RelationFragment>();
const tag: Tag = Object.assign(
  async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const parameters: unknown[] = [];
    const query = parts.reduce((text, part, i) => {
      if (!i) return part;
      const value = values[i - 1];
      if (
        value &&
        typeof value === "object" &&
        fragments.has(value as RelationFragment)
      )
        return text + (value as RelationFragment).relation + part;
      parameters.push(value);
      return text + `$${parameters.length}` + part;
    }, "");
    return (await pg.query(query, parameters)).rows;
  },
  {
    unsafe: (relation: string) => {
      assert.ok(
        ["auth.users", "private.runtime_auth_users"].includes(relation),
        "Only fixed reviewed Auth projections can be SQL fragments",
      );
      const fragment = Object.freeze({ relation });
      fragments.add(fragment);
      return fragment;
    },
  },
);
before(async () => {
  // Strip the server-only marker in this test namespace only, preserving the actual production SQL.
  const built = await build({
    absWorkingDir: process.cwd(),
    entryPoints: [path.resolve("src/server/community-recognition-inputs.ts")],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    plugins: [
      {
        name: "isolated-server-marker",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) => {
            if (args.path === "server-only")
              return { path: "server-only", namespace: "test-only" };
            if (args.path.startsWith("node:"))
              return { path: args.path, external: true };
            const target = args.path.startsWith("@/")
              ? path.resolve("src", args.path.slice(2))
              : path.isAbsolute(args.path)
                ? args.path
                : args.path.startsWith(".")
                  ? path.resolve(path.dirname(args.importer), args.path)
                  : createRequire(
                      args.importer || path.resolve("package.json"),
                    ).resolve(args.path);
            const file = [
              target,
              `${target}.ts`,
              `${target}.js`,
              path.join(target, "index.js"),
            ].find(existsSync);
            if (!file) throw Error("Unresolved isolated projection dependency");
            return { path: file, namespace: "projection-test" };
          });
          b.onLoad({ filter: /.*/, namespace: "test-only" }, () => ({
            contents: "",
            loader: "js",
          }));
          b.onLoad({ filter: /.*/, namespace: "projection-test" }, (args) => ({
            contents: readFileSync(args.path, "utf8"),
            loader: args.path.endsWith(".ts")
              ? "ts"
              : args.path.endsWith(".json")
                ? "json"
                : "js",
          }));
        },
      },
    ],
  });
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`
  );
  read = module.recognitionInputs;
  pg = new PGlite();
  await pg.exec(`create schema private; create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean,banned_until timestamptz);
    create table public.profiles(id uuid primary key,disabled_at timestamptz);
    create table private.social_profiles(id uuid primary key,user_id uuid,handle text,display_name text,joined_at timestamptz,is_official boolean default false,status text default 'active',visibility text default 'members');
    create table private.events(id text primary key,participants jsonb);
    create table private.market_references(id uuid primary key,reference jsonb,snapshot_ids text[]);
    create table private.odds_snapshots(id text primary key,evidence text);
    create table private.community_edges(id uuid primary key,profile_id uuid,event_id text,market_id text,market_rules jsonb,sport text,competition text,selection text,odds numeric,start_at timestamptz,submitted_at timestamptz,pricing_model text,classification text,market_reference_id uuid);
    create table private.community_settlements(id uuid primary key,edge_id uuid,result text,created_at timestamptz);
    create table private.social_posts(id uuid primary key,community_edge_id uuid,author_id uuid,kind text,claim_label text,moderation_status text,deleted_at timestamptz);
    create table private.social_comments(id uuid primary key,post_id uuid,author_id uuid,body text,moderation_status text,deleted_at timestamptz,created_at timestamptz);
    create table private.social_reactions(profile_id uuid,post_id uuid,created_at timestamptz);
    create table private.social_blocks(actor_id uuid,target_id uuid); create table private.social_mutes(actor_id uuid,target_id uuid);
    create table private.social_reports(target_type text,target_id uuid,status text);
    create table private.community_edge_personal_notes(edge_id uuid,metadata jsonb);
    create table private.community_edge_status(id uuid,edge_id uuid,status text,created_at timestamptz);
    create function private.community_feature_allowed(uuid,text) returns boolean language sql as $$select true$$;
    create function private.social_profile_visible(uuid,uuid,boolean) returns boolean language sql as $$select not exists(select 1 from private.social_blocks where (actor_id=$1 and target_id=$2) or (actor_id=$2 and target_id=$1))$$;`);
  await pg.query(
    "insert into auth.users values($1,'isolated@docked.test',$2,false,null)",
    [authorUser, "2026-01-01T00:00:00Z"],
  );
  await pg.query("insert into public.profiles values($1,null)", [authorUser]);
  await pg.query(
    "insert into private.social_profiles(id,user_id,handle,display_name,joined_at) values($1,$2,'fixture_author','DEMO author','2026-01-01')",
    [author, authorUser],
  );
  await pg.exec(
    `insert into private.events values('fixture-event','["DEMO A","DEMO B"]');`,
  );
  for (let i = 0; i <= 20; i++) {
    const id = i ? randomUUID() : edge,
      reference = randomUUID(),
      source = `fixture-${i}`;
    const start = i
      ? `2026-09-${String(i).padStart(2, "0")}T18:00:00Z`
      : "2026-10-05T18:00:00Z";
    await pg.query(
      "insert into private.odds_snapshots values($1,'market_data')",
      [source],
    );
    await pg.query(
      'insert into private.market_references values($1,\'{"evidenceMode":"current"}\',$2)',
      [reference, [source]],
    );
    await pg.query(
      "insert into private.community_edges values($1,$2,'fixture-event','fixture-market','{\"market\":\"football_1x2\",\"settlement\":\"regulation\"}','football','fixture','DEMO A',2.5,$3,$3::timestamptz-interval '1 hour','market_reference_v1','STANDARD_VERIFIED',$4)",
      [id, author, start, reference],
    );
    if (i)
      await pg.query(
        "insert into private.community_settlements values($1,$2,$3,$4::timestamptz+interval '3 hours')",
        [randomUUID(), id, i % 2 ? "WON" : "LOST", start],
      );
  }
  await pg.query(
    "update private.community_edges set submitted_at='2026-10-05T10:00:00Z' where id=$1",
    [edge],
  );
  await pg.query(
    "insert into private.social_posts values($1,$2,$3,'edge','social_only','visible',null)",
    [post, edge, author],
  );
  for (let i = 0; i < 3; i++) {
    const person = randomUUID(),
      user = randomUUID();
    await pg.query(
      "insert into auth.users values($1,$2,'2026-01-01',false,null)",
      [user, `isolated-${i}@docked.test`],
    );
    await pg.query("insert into public.profiles values($1,null)", [user]);
    await pg.query(
      "insert into private.social_profiles(id,user_id,handle,display_name,joined_at) values($1,$2,$3,'DEMO actor','2026-01-01')",
      [person, user, `fixture_${i}`],
    );
    await pg.query(
      "insert into private.social_reactions values($1,$2,'2026-10-05T11:30:00Z'::timestamptz+$3*interval '2 minutes')",
      [person, post, i],
    );
  }
});
after(async () => pg?.close());
test("real recognition SQL excludes banned authors and banned/reported/young-style ineligible actor projections", async () => {
  const baseline = await read(tag, viewer, now);
  assert.equal(baseline.length, 1);
  assert.equal(baseline[0].engagements.length, 3);
  assert.equal(baseline[0].settledSample, 20);
  assert.equal(baseline[0].activeDays, 20);
  await pg.exec("begin");
  try {
    await pg.query(
      "update auth.users set banned_until='2027-01-01' where id=$1",
      [authorUser],
    );
    assert.equal((await read(tag, viewer, now)).length, 0);
  } finally {
    await pg.exec("rollback");
  }
  await pg.exec("begin");
  try {
    await pg.query(
      "update auth.users set banned_until='2027-01-01' where id<>$1",
      [authorUser],
    );
    assert.equal((await read(tag, viewer, now))[0].engagements.length, 0);
  } finally {
    await pg.exec("rollback");
  }
});
test("real recognition SQL excludes missing/demo source evidence from discovery and sample counts", async () => {
  await pg.exec("begin");
  try {
    await pg.exec(
      "update private.odds_snapshots set evidence='demo' where id='fixture-1'",
    );
    assert.equal((await read(tag, viewer, now))[0].settledSample, 19);
    await pg.exec("delete from private.odds_snapshots where id='fixture-2'");
    assert.equal((await read(tag, viewer, now))[0].settledSample, 18);
    await pg.exec(
      "update private.odds_snapshots set evidence='demo' where id='fixture-0'",
    );
    assert.equal((await read(tag, viewer, now)).length, 0);
  } finally {
    await pg.exec("rollback");
  }
});
test("real recognition SQL withholds blocked authors, rejects moderation/promotion, and keeps global winner input", async () => {
  await pg.exec("begin");
  try {
    await pg.query("insert into private.social_blocks values($1,$2)", [
      viewer,
      author,
    ]);
    const rows = await read(tag, viewer, now);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].viewerVisible, false);
    await pg.query(
      "insert into private.social_reports values('post',$1,'open')",
      [post],
    );
    assert.equal((await read(tag, viewer, now)).length, 0);
  } finally {
    await pg.exec("rollback");
  }
  await pg.exec("begin");
  try {
    await pg.query(
      "insert into private.community_edge_personal_notes values($1,'{\"promotional\":true}')",
      [edge],
    );
    assert.equal((await read(tag, viewer, now)).length, 0);
  } finally {
    await pg.exec("rollback");
  }
});
