// LOCAL ONLY: real Supabase Auth, Next HTTP handlers and restricted-role Postgres.
// Run after marketplace-auth-infra.mjs and its local compose startup. Never loads .env.
import assert from "node:assert/strict";
import {
  readFile,
  writeFile,
  readdir,
  mkdir,
  cp,
  symlink,
  access,
} from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { randomBytes, randomUUID, createHash, createHmac } from "node:crypto";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { request, chromium, expect } from "@playwright/test";
import { marketplaceFixture } from "../tests/fixtures/marketplace-state";
import { rarityConfiguration } from "../src/core/card-rarity";
import { initialMemberTestCredits } from "../src/core/member-test-wallet";
import { validateCredits } from "../src/core/credits-sandbox";
import {
  prepareIntegratedCatalogue,
  runIntegratedMarketplace,
} from "./marketplace-integrated-local";

import { seedRedemptionAuth, runRedemptionAuth } from "./redemption-auth-local";
const redemption = process.argv.includes("--redemption");
const integrated = process.argv.includes("--integrated");
const socialOnly = process.argv.includes("--social-only");
const socialUpgrade = process.argv.includes("--social-upgrade");
const socialVisual = process.argv.includes("--social-visual");
const root = process.cwd(),
  dir = resolve(
    redemption
      ? "tmp/redemption-auth"
      : integrated
        ? "tmp/marketplace-integrated-v2"
        : "tmp/marketplace-auth",
  ),
  origin = "http://127.0.0.1:3033",
  authOrigin = redemption ? "http://127.0.0.1:55331" : "http://127.0.0.1:55321";
function totp(secret: string) {
  let bits = "";
  for (const c of secret.toUpperCase().replace(/=+$/, ""))
    bits += "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
      .indexOf(c)
      .toString(2)
      .padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const mac = createHmac("sha1", key).update(counter).digest(),
    offset = mac[19] & 15;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
    6,
    "0",
  );
}
async function main() {
  const keys = JSON.parse(
    await readFile(resolve(dir, "status.private.json"), "utf8"),
  );
  assert.equal(keys.API_URL, authOrigin);
  const dbUrl = new URL(keys.DB_URL);
  assert.equal(dbUrl.hostname, "127.0.0.1");
  assert.equal(dbUrl.port, redemption ? "55332" : "55322");
  assert.equal(
    dbUrl.pathname,
    redemption ? "/docked_redemption_local_auth" : "/postgres",
  );
  const sql = postgres(dbUrl.href, { max: 3, onnotice: () => {} }),
    admin = createClient(authOrigin, keys.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  let child: ReturnType<typeof spawn> | undefined;
  let previewReady = false;
  const contexts: Awaited<ReturnType<typeof request.newContext>>[] = [];
  const checks: string[] = [];
  let stage = "migrations";
  await mkdir("docs/qa/marketplace-authenticated", { recursive: true });
  const browserOnly = process.argv.includes("--browser-only");
  await mkdir("docs/qa/mobile-release", { recursive: true });
  await mkdir("docs/qa/premium-completion", { recursive: true });
  await mkdir("docs/qa/social-upgrade", { recursive: true });
  await mkdir("docs/qa/social-visual-preview", { recursive: true });
  const receipt = socialVisual
    ? "docs/qa/social-visual-preview/authenticated.json"
    : redemption
      ? "docs/qa/premium-completion/authenticated.json"
      : socialOnly
        ? socialUpgrade
          ? `docs/qa/social-upgrade/${browserOnly ? "browser" : "authenticated"}.json`
          : "docs/qa/mobile-release/social-http.json"
        : `docs/qa/marketplace-authenticated/${integrated ? (browserOnly ? "integrated-readback" : "integrated") : browserOnly ? "browser" : "http"}.json`;
  await writeFile(
    receipt,
    JSON.stringify({
      passed: false,
      status: "RUNNING",
      at: new Date().toISOString(),
    }),
  );
  try {
    await sql`create table if not exists public.local_qa_migrations(name text primary key,hash text not null)`;
    for (const file of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const source = await readFile("supabase/migrations/" + file, "utf8"),
        hash = createHash("sha256").update(source).digest("hex");
      const prior =
        await sql`select hash from public.local_qa_migrations where name=${file}`;
      if (prior.length) {
        assert.equal(prior[0].hash, hash);
        continue;
      }
      try {
        await sql.begin(async (tx) => {
          await tx.unsafe(source);
          await tx`insert into public.local_qa_migrations values(${file},${hash})`;
        });
      } catch (e) {
        throw Error("Local migration " + file + ": " + (e as Error).message);
      }
    }
    stage = "accounts";
    const fixturesPath = resolve(dir, "fixtures.private.json");
    let qa: any;
    try {
      qa = JSON.parse(await readFile(fixturesPath, "utf8"));
    } catch {
      qa = {
        password: randomBytes(24).toString("hex"),
        dbPassword: randomBytes(24).toString("hex"),
        users: [],
      };
      await writeFile(fixturesPath, JSON.stringify(qa));
    }
    for (let i = qa.users.length; i < 5; i++) {
      const email = `market-qa-${i}@example.invalid`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: qa.password,
        email_confirm: true,
      });
      assert.ifError(error);
      qa.users.push({ id: data.user!.id, email });
      await writeFile(fixturesPath, JSON.stringify(qa));
    }
    const auths = qa.users.map(() =>
      createClient(authOrigin, keys.ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    );
    const sessions = [];
    for (const [i, u] of qa.users.entries()) {
      const { data, error } = await auths[i].auth.signInWithPassword({
        email: u.email,
        password: qa.password,
      });
      assert.ifError(error);
      sessions.push(data.session!);
    }
    // A genuine local administrator factor; no production MFA/account is touched.
    const owner = qa.users[3];
    if (!qa.totp) {
      const { data, error } = await auths[3].auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Local acceptance",
      });
      assert.ifError(error);
      qa.totp = { id: data.id, secret: data.totp.secret };
      await writeFile(fixturesPath, JSON.stringify(qa));
    }
    const verified = await auths[3].auth.mfa.challengeAndVerify({
      factorId: qa.totp.id,
      code: totp(qa.totp.secret),
    });
    assert.ifError(verified.error);
    stage = "admission";
    const versions = Object.fromEntries(
        [
          "terms",
          "privacy",
          "beta",
          "community",
          "fantasy",
          "competition",
          "responsible_gambling",
        ].map((k) => [k, "local-http-qa-v1"]),
      ),
      digest = "b".repeat(64);
    await sql`update beta_private.admission_control set enabled=true,testers_enabled=true,policy_digest=${digest},policy_versions=${sql.json(versions)},approved_by='local-qa-only',approved_at=clock_timestamp()`;
    await sql`insert into beta_private.designated_administrators(user_id,designated_by)values(${owner.id},'local-qa-only') on conflict do nothing`;
    // Owner may be reserved before the first owner control is created. Thereafter identity is immutable.
    for (const i of [3, 0, 1, 2]) {
      const u = qa.users[i];
      if (i !== 3) {
        await sql`insert into beta_private.friends_roster(user_id,email,enabled,authority)values(${u.id},${u.email},true,'Isolated local HTTP acceptance fixture') on conflict do nothing`;
      }
      const existing =
        await sql`select id,status from beta_private.admissions where user_id=${u.id}`;
      if (!existing.length || existing[0].status === "reserved") {
        const token = randomBytes(32).toString("hex");
        if (!existing.length)
          await sql`select beta_private.reserve_admission(${u.email},${u.id},${createHash("sha256").update(token).digest("hex")},${randomUUID()},${new Date(Date.now() + 3600000)},'local-qa')`;
        else
          await sql.begin(async (tx) => {
            await tx`update beta_private.admissions set token_digest=${createHash("sha256").update(token).digest("hex")},expires_at=${new Date(Date.now() + 3600000)} where id=${existing[0].id}`;
            await tx`insert into beta_private.admission_events(admission_id,action,actor,details)values(${existing[0].id},'local_qa_reservation_retry','local-qa','{"reason":"Recover interrupted isolated test setup before acceptance"}')`;
          });
        const claims = JSON.parse(
          Buffer.from(
            sessions[i].access_token.split(".")[1],
            "base64url",
          ).toString(),
        );
        await sql`select beta_private.accept_admission(${token},${u.id},${claims.session_id},'AU','NSW',true,${sql.json(versions)})`;
      }
      await sql`insert into beta_public.profiles(id,country,state,age_attested,accepted_version)values(${u.id},'AU','NSW',true,'local-http-qa-v1') on conflict do nothing`;
      await sql`insert into credits_sandbox.access(user_id,kind,label,enabled,authority_note)values(${u.id},${i === 3 ? "owner" : "tester"},${"Local QA " + i},true,'Local HTTP acceptance only') on conflict do nothing`;
      if (i === 3) {
        await sql`insert into beta_private.roles(user_id,role)values(${owner.id},'owner') on conflict do nothing`;
        await sql`insert into beta_private.owner_gameplay_control(owner_id,enabled,authority)values(${owner.id},true,'Local HTTP acceptance fixture only') on conflict do nothing`;
        await sql`update beta_private.friends_control set enabled=true,readiness_evidence='Isolated local HTTP acceptance configuration only',approved_by='local-qa',approved_at=clock_timestamp()`;
      }
    }
    if (socialOnly) {
      await sql`insert into beta_private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,evidence)
        select 'AU','NSW','local-social-acceptance',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 day',clock_timestamp()+interval '1 day',true,18,array['community_social','public_profiles'],'Isolated local social fixture; not hosted approval'
        where not exists(select 1 from beta_private.region_policies where version='local-social-acceptance' and effective_to>clock_timestamp()) on conflict(country,state,version) do update set effective_from=clock_timestamp()-interval '1 minute',effective_to=clock_timestamp()+interval '1 day',review_at=clock_timestamp()+interval '1 day'`;
    }
    stage = "inventory";
    if (redemption) await seedRedemptionAuth(sql, qa.users);
    if (
      !redemption &&
      !(await sql`select id from credits_sandbox.state`).length
    ) {
      const state = marketplaceFixture(
        Date.now(),
        qa.users
          .slice(0, 3)
          .map((u: any) => ({ id: u.id, role: "member" as const })),
        integrated,
      );
      await sql`insert into credits_sandbox.rarity_configuration values(${rarityConfiguration.version},${sql.json(rarityConfiguration)})`;
      for (const p of Object.values(state.economy!.players) as any[])
        await sql`insert into credits_sandbox.permanent_players values(${p.id},${p.sport},${p.provider},${p.providerId},${p.assetKind},${sql.json(p)})`;
      for (const p of Object.values(state.economy!.products) as any[])
        await sql`insert into credits_sandbox.pack_configuration values(${p.version},${sql.json(p)})`;
      await sql`insert into credits_sandbox.state values(true,0,${sql.json(initialMemberTestCredits() as any)})`;
      for (const j of state.journal)
        await sql`insert into credits_sandbox.journal values(${j.id},${sql.json(j)})`;
      await sql`update credits_sandbox.state set document=${sql.json(JSON.parse(JSON.stringify(state)))}`;
    }
    if (integrated) await prepareIntegratedCatalogue(sql, qa.users.slice(0, 3));
    await sql.unsafe(
      `alter role docked_beta_app login password '${qa.dbPassword}'`,
    );
    stage = "app-start";
    const app = resolve(dir, "app");
    await mkdir(app, { recursive: true });
    for (const path of [
      "src",
      "config",
      "public",
      "certs",
      "next.config.ts",
      "tsconfig.json",
      "package.json",
      "next-env.d.ts",
    ])
      await cp(resolve(root, path), resolve(app, path), { recursive: true });
    try {
      await access(resolve(app, "node_modules"));
    } catch {
      await symlink(
        resolve(root, "node_modules"),
        resolve(app, "node_modules"),
        "junction",
      );
    }
    if (redemption) {
      // Local diagnostic copy only: report SQLSTATE/permission identifiers, never request or secret values.
      const route = resolve(app, "src/app/api/redemptions/route.ts");
      await writeFile(
        route,
        (await readFile(route, "utf8")).replace(
          "} catch (e) {",
          `} catch (e) {
        if (typeof e === "object" && e && "code" in e) console.error("LOCAL_SQLSTATE", e.code, e instanceof Error && /^(permission denied|new row violates row-level security policy)/.test(e.message) ? e.message : "details withheld");`,
        ),
      );
    }
    if (socialUpgrade) {
      const route = resolve(app, "src/server/community-social.ts");
      await writeFile(
        route,
        (await readFile(route, "utf8")).replace(
          '} catch {\n    return gate(\n      "unavailable",',
          '} catch (e) {\n    console.error("LOCAL_SOCIAL_READ", e instanceof Error ? e.message : "unknown");\n    return gate(\n      "unavailable",',
        ),
      );
    }
    const runtime = new URL(dbUrl.href);
    runtime.username = "docked_beta_app";
    runtime.password = qa.dbPassword;
    const inherited = Object.fromEntries(
      Object.entries(process.env).filter(([k]) =>
        /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA|PROCESSOR_|NUMBER_OF_PROCESSORS)/i.test(
          k,
        ),
      ),
    );
    const env: NodeJS.ProcessEnv = { ...inherited, NODE_ENV: "development" };
    Object.assign(env, {
      NODE_ENV: "development",
      DOCKED_LOCAL_MARKETPLACE_ACCEPTANCE: "true",
      ...(socialUpgrade ? { DOCKED_PRIVATE_OFFERS_LOCAL: "true" } : {}),
      DOCKED_BETA_STAGING: "true",
      DOCKED_FRIENDS_BETA: "true",
      DOCKED_OWNER_GAMEPLAY: "true",
      BETA_ACCESS_ENABLED: "true",
      APP_ENV: redemption ? "development" : "production",
      ...(redemption
        ? {
            DOCKED_REDEMPTION_LOCAL: "true",
            DOCKED_REDEMPTION_BANK_KEY: Buffer.alloc(32, 7).toString("base64"),
          }
        : {}),
      SUPABASE_ENV: "production",
      SITE_URL: origin,
      NEXT_PUBLIC_SUPABASE_URL: authOrigin,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        keys.PUBLISHABLE_KEY || keys.ANON_KEY,
      DATABASE_URL: runtime.href,
      DATABASE_RUNTIME: "persistent",
      DOCKED_RELEASE_CHANNEL: "beta",
      NEXT_TELEMETRY_DISABLED: "1",
      FANTASY_FREE_PLAY_PRODUCTION: "true",
      BETA_TESTERS_ENABLED: "true",
    });
    for (const key of [
      "REGISTRATION_ENABLED",
      "SENDING_ENABLED",
      "AUTH_EMAIL_ENABLED",
      "PAID_PLANS_ENABLED",
      "PRIZES_ENABLED",
      "COMPETITIONS_ENABLED",
      "ADS_ENABLED",
      "AFFILIATES_ENABLED",
      "DEALS_ENABLED",
      "DEMO_MODE",
      "DOCKED_HOSTED_PREVIEW",
      "DOCKED_HOSTED_PRODUCTION",
      "DOCKED_HOSTED_REVIEW",
    ])
      env[key] = "false";
    const log = createWriteStream(resolve(dir, "next.private.log"));
    child = spawn(
      process.execPath,
      [
        resolve(root, "node_modules/next/dist/bin/next"),
        "dev",
        "--webpack",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3033",
      ],
      { cwd: app, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    );
    child.stdout!.pipe(log);
    child.stderr!.pipe(log);
    for (let n = 0; n < 90; n++) {
      try {
        const r = await fetch(origin + "/api/marketplace");
        if (r.status === 401) break;
        if (n === 89)
          throw Error("Local app did not reach anonymous 401: " + r.status);
      } catch (e) {
        if (n === 89) throw e;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    stage = "http-journey";
    for (let i = 0; i < 5; i++) {
      const c = await request.newContext({
        baseURL: origin,
        extraHTTPHeaders: { Origin: origin },
      });
      contexts.push(c);
      const r = await c.post("/api/auth", {
        data: {
          action: "login",
          email: qa.users[i].email,
          password: qa.password,
          app: true,
        },
      });
      assert.equal((await r.json()).ok, true, "Real application login " + i);
    }
    if (redemption) {
      stage = "redemption-auth-http";
      checks.push(
        ...(await runRedemptionAuth({ sql, contexts, qa, totp, origin })),
      );
      await writeFile(
        receipt,
        JSON.stringify(
          {
            passed: true,
            at: new Date().toISOString(),
            scope:
              "Actual Next routes, real local Supabase Auth/MFA, restricted-role PostgreSQL; isolated fixtures",
            checks,
            hostedOperations: false,
            physicalDevice: false,
          },
          null,
          2,
        ),
      );
      console.log(JSON.stringify({ passed: true, checks }));
      return;
    }
    if (socialOnly) {
      stage = "social-http";
      for (const i of socialUpgrade ? [0, 1, 2] : [0, 1]) {
        const existingProfile =
          await sql`select id from beta_private.social_profiles where user_id=${qa.users[i].id} and handle=${"localreader" + i}`;
        if (existingProfile.length) continue;
        const r = await contexts[i].post("/api/community", {
          data: {
            action: "profile",
            handle: "localreader" + i,
            displayName: "Local Reader " + i,
            bio: "Isolated local acceptance",
            visibility: "members",
          },
        });
        assert.equal(
          r.status(),
          200,
          "Social profile " + i + ": " + (await r.text()),
        );
      }
      if (socialUpgrade && !browserOnly)
        checks.push(
          ...(await (
            await import("./social-upgrade-acceptance")
          ).runSocialUpgrade(sql, contexts)),
        );
      if (socialUpgrade)
        checks.push(
          ...(await (
            await import("./social-upgrade-access")
          ).verifySocialAccess(contexts, totp(qa.totp.secret))),
        );
      const marker = "Isolated social acceptance " + randomUUID();
      const payload = {
        action: "post",
        kind: "discussion",
        body: marker,
        sport: "nfl",
        mediaIds: [],
        promotional: false,
        idempotencyKey: randomUUID(),
      };
      const sent = await contexts[0].post("/api/community", { data: payload });
      assert.equal(sent.status(), 200, await sent.text());
      const first = await sent.json();
      const retry = await contexts[0].post("/api/community", { data: payload });
      assert.equal(retry.status(), 200, await retry.text());
      assert.equal((await retry.json()).id, first.id);
      for (const i of socialUpgrade ? [0, 1, 2] : [0, 1]) {
        const r = await contexts[i].get("/api/community?view=feed&tab=latest");
        assert.equal(r.status(), 200);
        const f = await r.json();
        assert.equal(f.status, "ready");
        assert.equal(f.posts.filter((p: any) => p.id === first.id).length, 1);
      }
      const denied = await contexts[1].post("/api/community", {
        data: { action: "delete_post", postId: first.id },
      });
      assert.notEqual(denied.status(), 200);
      const anonymous = await fetch(
        origin + "/api/community?view=feed&tab=latest",
      );
      const body = await anonymous.json();
      assert.equal(body.posts?.length ?? 0, 0);
      const [stored] =
        await sql`select count(*)::int n from beta_private.social_posts where idempotency_key=${payload.idempotencyKey}`;
      assert.equal(stored.n, 1);
      const browser = await chromium.launch({ channel: "msedge" });
      try {
        if (socialVisual)
          checks.push(
            ...(await (
              await import("./social-avatar-acceptance")
            ).verifySocialAvatars(contexts, browser, origin)),
          );
        const context = await browser.newContext({
          storageState: await contexts[0].storageState(),
          viewport: { width: 412, height: 815 },
        });
        const page = await context.newPage();
        await page.goto(origin + "/fantasy/social", {
          timeout: 120000,
          waitUntil: "domcontentloaded",
        });
        await expect(
          page.getByRole("navigation", { name: "Social sections" }),
        ).toBeVisible();
        await expect(page.getByText(marker, { exact: true })).toBeVisible();
        const browserMarker = "Local browser post " + randomUUID();
        await page
          .getByRole("textbox", { name: "Your post" })
          .fill(browserMarker);
        const posted = page.waitForResponse(
          (r) =>
            r.url().endsWith("/api/community") &&
            r.request().method() === "POST",
          { timeout: 30000 },
        );
        await page.getByRole("button", { name: "Post", exact: true }).click();
        assert.equal((await posted).status(), 200);
        await expect(
          page.getByRole("textbox", { name: "Your post" }),
        ).toHaveValue("", { timeout: 30000 });
        await expect(
          page.getByText(browserMarker, { exact: true }),
        ).toBeVisible({ timeout: 20000 });
        await expect(page).toHaveURL(/fantasy\/social\?tab=latest/, {
          timeout: 30000,
        });
        await page.reload();
        await expect(
          page.getByText(browserMarker, { exact: true }),
        ).toBeVisible();
        await page
          .getByRole("link", { name: "Following", exact: true })
          .click();
        await expect(page).toHaveURL(/tab=following/);
        await page
          .getByRole("link", { name: "My activity", exact: true })
          .click();
        await expect(page).toHaveURL(/profile\/localreader0/, {
          timeout: 120000,
        });
        await expect(
          page.getByText(browserMarker, { exact: true }),
        ).toBeVisible({ timeout: 30000 });
        await page.screenshot({
          path: socialUpgrade
            ? "docs/qa/social-upgrade/my-posts-mobile.png"
            : "docs/qa/mobile-release/my-posts-mobile.png",
          fullPage: true,
        });
        if (socialUpgrade)
          checks.push(
            ...(await (
              await import("./social-upgrade-browser")
            ).captureSocialUpgrade(
              browser,
              contexts,
              origin,
              socialVisual ? "docs/qa/social-visual-preview" : undefined,
            )),
          );
        await context.close();
      } finally {
        await browser.close();
      }
      const report = {
        passed: true,
        at: new Date().toISOString(),
        scope:
          "Local real GoTrue authentication -> application HTTP -> PostgreSQL plus Edge browser; isolated QA identities only",
        checks: [
          ...checks,
          "Ordinary member post and own/second-member feed visibility",
          "Same idempotency key returns one retained post",
          "Other-member deletion and anonymous feed denied",
          "Inline composer publishes, returns to feed and survives refresh",
          "Following and My posts navigate correctly",
        ],
        hostedPosts: false,
      };
      await writeFile(receipt, JSON.stringify(report, null, 2));
      console.log(JSON.stringify(report));
      if (socialUpgrade && process.argv.includes("--keep-preview")) {
        const preview = await chromium.launch({
          channel: "msedge",
          headless: false,
        });
        const previewContext = await preview.newContext({
          storageState: await contexts[1].storageState(),
          viewport: { width: 1440, height: 960 },
        });
        const previewPage = await previewContext.newPage();
        await previewPage.goto(origin + "/fantasy/social", {
          waitUntil: "domcontentloaded",
        });
        previewReady = true;
        preview.on("disconnected", () => child?.kill());
        console.log(
          "Local QA preview ready at " +
            origin +
            "/fantasy/social. Close its Edge window to stop the preview.",
        );
      }
      return;
    }
    const read = async (i: number, query = "") => {
      const r = await contexts[i].get("/api/marketplace" + query);
      assert.equal(r.status(), 200, await r.text());
      return r.json();
    };
    const command = async (i: number, command: unknown, id = randomUUID()) => {
      const r = await contexts[i].post("/api/marketplace", {
        data: { request: id, command },
      });
      return { status: r.status(), body: await r.json() };
    };
    let browserState = await contexts[1].storageState();
    if (integrated && !browserOnly) {
      stage = "integrated-competition-transfer-scoring";
      checks.push(
        ...(await runIntegratedMarketplace(
          sql,
          contexts,
          qa.users.slice(0, 3),
        )),
      );
    }
    if (!browserOnly && !integrated) {
      const seller = await read(0),
        buyer = await read(1);
      assert.notEqual(seller.state.member, buyer.state.member);
      assert.equal(
        (await contexts[3].get("/api/marketplace")).status(),
        403,
        "Owner AAL1 denied",
      );
      assert.equal(
        (await contexts[4].get("/api/marketplace")).status(),
        401,
        "Unadmitted identity denied",
      );
      checks.push(
        "Real Next login and GoTrue sessions; ordinary AAL1 admitted; owner AAL1 and unadmitted user denied",
      );
      const card = seller.state.inventory.find(
        (c: any) => !c.listed && !c.transferReason,
      );
      assert.ok(card, "Eligible local owned card");
      const listing = randomUUID(),
        review = randomUUID(),
        purchase = randomUUID();
      assert.equal(
        (
          await command(
            0,
            { kind: "list", card: card.id, price: 1000 },
            listing,
          )
        ).status,
        200,
      );
      assert.equal(
        (await command(1, { kind: "review-buy", listing }, review)).status,
        200,
      );
      const buy = {
        kind: "buy",
        listing,
        review,
        expectedPrice: 1000,
        policy: buyer.state.policy,
        confirmed: true,
      };
      // Deliberately discard the successful HTTP response. Recover using its original ID.
      assert.equal((await command(1, buy, purchase)).status, 200);
      const beforeReplay = (
        await sql`select document from credits_sandbox.state`
      )[0].document;
      const replay = await command(1, buy, purchase);
      assert.equal(replay.status, 200);
      assert.deepEqual(
        (await sql`select document from credits_sandbox.state`)[0].document,
        beforeReplay,
      );
      const afterSeller = await read(0, "?tab=activity"),
        afterBuyer = await read(1, "?tab=activity"),
        third = await read(2, "?tab=activity");
      console.log(
        "Sale projections returned; verifying balances and receipts.",
      );
      assert.equal(
        afterSeller.state.wallet.available,
        seller.state.wallet.available + 925,
      );
      assert.equal(
        afterBuyer.state.wallet.available,
        buyer.state.wallet.available - 1000,
      );
      assert.equal(beforeReplay.commerce.cards[card.id].owner, qa.users[1].id);
      assert.equal(beforeReplay.listings[listing].status, "SOLD");
      assert.equal(beforeReplay.listings[listing].receipt.fee, 75);
      console.log("Balance/ownership verified; checking activity.");
      assert.ok(
        afterSeller.state.activity.some((a: any) => a.listing === listing),
        "Seller sale receipt visible",
      );
      assert.ok(
        afterBuyer.state.activity.some((a: any) => a.listing === listing),
        "Buyer purchase receipt visible",
      );
      assert.ok(
        !third.state.activity.some((a: any) => a.listing === listing),
        "Third party receipt excluded",
      );
      console.log("Activity verified; testing denied mutations.");
      assert.equal(
        (await command(2, { kind: "list", card: card.id, price: 100 })).status,
        400,
      );
      assert.equal(
        (await command(2, { kind: "cancel-listing", listing })).status,
        400,
      );
      const forgedMember = await read(
        2,
        "?tab=activity&member=" + qa.users[1].id,
      );
      assert.equal(forgedMember.state.member, qa.users[2].id);
      assert.ok(
        !forgedMember.state.activity.some((a: any) => a.listing === listing),
        "Ignored client identity cannot reveal another receipt",
      );
      checks.push(
        "Seller listing, distinct signed-in buyer review/purchase, 1000/75/925, database ownership, private durable receipts, unauthorized mutations and lost-response same-ID recovery",
      );
      stage = "authenticated-contention";
      const raceCard = (await read(0)).state.inventory.find(
        (c: any) => !c.listed && !c.transferReason,
      );
      assert.ok(
        raceCard,
        "Local seller has another eligible card for contention",
      );
      const raceListing = randomUUID(),
        raceReviews = [randomUUID(), randomUUID()];
      assert.equal(
        (
          await command(
            0,
            { kind: "list", card: raceCard.id, price: 100 },
            raceListing,
          )
        ).status,
        200,
      );
      for (let i = 0; i < 2; i++)
        assert.equal(
          (
            await command(
              i + 1,
              { kind: "review-buy", listing: raceListing },
              raceReviews[i],
            )
          ).status,
          200,
        );
      let contested!: Promise<
        PromiseSettledResult<{ status: number; body: any }>[]
      >;
      let waiting = 0;
      await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(71820342)`;
        contested = Promise.allSettled(
          [1, 2].map((i) =>
            command(i, {
              kind: "buy",
              listing: raceListing,
              review: raceReviews[i - 1],
              expectedPrice: 100,
              policy: buyer.state.policy,
              confirmed: true,
            }),
          ),
        );
        for (let attempt = 0; attempt < 100; attempt++) {
          await tx`select pg_stat_clear_snapshot()`;
          waiting = (
            await tx`select count(*)::int n from pg_stat_activity where usename='docked_beta_app' and wait_event='advisory'`
          )[0].n;
          if (waiting >= 2) break;
          await tx`select pg_sleep(0.05)`;
        }
      });
      const settled = await contested;
      assert.ok(
        waiting >= 2,
        "Distinct authenticated HTTP buyers must reach two blocked database connections",
      );
      assert.ok(
        settled.every((r) => r.status === "fulfilled"),
        "Both local HTTP requests completed without a transport failure",
      );
      const outcomes = settled.map(
        (r) => (r as PromiseFulfilledResult<{ status: number }>).value,
      );
      assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 400]);
      const raced = (await sql`select document from credits_sandbox.state`)[0]
        .document;
      assert.equal(raced.listings[raceListing].status, "SOLD");
      assert.equal(raced.listings[raceListing].receipt.fee, 8);
      assert.equal(raced.listings[raceListing].receipt.net, 92);
      assert.ok(
        [qa.users[1].id, qa.users[2].id].includes(
          raced.commerce.cards[raceCard.id].owner,
        ),
        "Winning buyer owns the unchanged instance",
      );
      checks.push(
        "Two DISTINCT real signed-in HTTP buyers reached separate blocked PostgreSQL connections: exactly one 100-credit sale, 8 commission, 92 proceeds",
      );
      stage = "session-switch";
      const old = await contexts[0].storageState();
      assert.equal(
        (
          await contexts[0].post("/api/auth", { data: { action: "logout" } })
        ).status(),
        200,
      );
      assert.equal((await contexts[0].get("/api/marketplace")).status(), 401);
      const copied = await request.newContext({
        baseURL: origin,
        storageState: old,
      });
      contexts.push(copied);
      assert.equal(
        (await copied.get("/api/marketplace")).status(),
        401,
        "Copied revoked session denied",
      );
      const switched = await contexts[0].post("/api/auth", {
        data: {
          action: "login",
          email: qa.users[2].email,
          password: qa.password,
          app: true,
        },
      });
      assert.equal((await switched.json()).ok, true);
      assert.equal((await read(0)).state.member, qa.users[2].id);
      checks.push(
        "Actual logout revokes copied session; same cookie jar switches accounts without prior private activity",
      );
      stage = "refresh";
      const persisted = await contexts[1].storageState();
      const authCookie = persisted.cookies.find(
        (c) =>
          c.name.includes("-auth-token") && !c.name.endsWith("code-verifier"),
      );
      assert.ok(authCookie);
      const parts = persisted.cookies
        .filter((c) => c.name.startsWith(authCookie.name.split(".")[0]))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => c.value)
        .join("");
      const tokenState = JSON.parse(
        Buffer.from(parts.replace(/^base64-/, ""), "base64url").toString(),
      );
      const claims = JSON.parse(
        Buffer.from(
          tokenState.access_token.split(".")[1],
          "base64url",
        ).toString(),
      );
      assert.ok(
        claims.exp * 1000 - Date.now() < 190000,
        "Use 120-second local JWT expiry, not a production lifetime",
      );
      console.log(
        "Real local HTTP sale passed; waiting for genuine short-lived JWT expiry before reopen/refresh.",
      );
      await new Promise((r) =>
        setTimeout(r, Math.max(0, claims.exp * 1000 - Date.now() + 1200)),
      );
      const reopened = await request.newContext({
        baseURL: origin,
        extraHTTPHeaders: { Origin: origin },
        storageState: persisted,
      });
      contexts.push(reopened);
      const refreshed = await reopened.get("/api/marketplace");
      assert.equal(refreshed.status(), 200, await refreshed.text());
      assert.equal((await refreshed.json()).state.member, qa.users[1].id);
      assert.notDeepEqual(
        (await reopened.storageState()).cookies,
        persisted.cookies,
        "Real refresh replaces cookies",
      );
      checks.push(
        "Persisted session reopened after actual JWT expiry; real GoTrue refresh succeeds and returns correct member inventory",
      );
      browserState = await reopened.storageState();
    }
    stage = "browser";
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        storageState: browserState,
        viewport: { width: 412, height: 915 },
      });
      const page = await context.newPage();
      const browserErrors: string[] = [];
      page.on("pageerror", (e) => browserErrors.push(e.message.split("\n")[0]));
      const response = page.waitForResponse(
        (r) =>
          r.url().startsWith(origin + "/api/marketplace") &&
          r.request().method() === "GET",
      );
      await page.goto(origin + "/fantasy/market");
      const responseOrError = await response.catch(async (e) => {
        await writeFile(
          "docs/qa/marketplace-authenticated/browser-errors.json",
          JSON.stringify(browserErrors, null, 2),
        );
        throw e;
      });
      assert.equal(
        responseOrError.status(),
        200,
        "Browser fetch reaches actual authenticated market API",
      );
      await expect(
        page.getByText("Loading market…", { exact: true }),
      ).toBeHidden();
      await expect(
        page.getByRole("heading", { name: "Market", exact: true }),
      ).toBeVisible({ timeout: 60000 });
      await expect(
        page.getByRole("navigation", { name: "Marketplace sections" }),
      ).toBeVisible();
      await page.screenshot({
        path: "docs/qa/marketplace-authenticated/member-market-mobile.png",
        fullPage: true,
      });
      await page.reload();
      await expect(
        page.getByText("Loading market…", { exact: true }),
      ).toBeHidden();
      await expect(
        page.getByRole("heading", { name: "Market", exact: true }),
      ).toBeVisible();
      checks.push(
        "Real authenticated browser market API returns 200 and loading completes; market page and reload at 412px",
      );
    } finally {
      await browser.close();
    }
    stage = "final";
    validateCredits(
      (await sql`select document from credits_sandbox.state`)[0].document,
    );
    await writeFile(
      receipt,
      JSON.stringify(
        {
          passed: true,
          at: new Date().toISOString(),
          scope:
            "Actual local Next HTTP -> real GoTrue Auth -> PostgreSQL, synthetic QA assets only",
          checks,
          hostedOperations: false,
          physicalDevice: false,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ passed: true, checks }));
  } catch (e) {
    await writeFile(
      receipt,
      JSON.stringify(
        {
          passed: false,
          stage,
          at: new Date().toISOString(),
          error: (e as Error).message.split("\nCall log:")[0],
          checks,
        },
        null,
        2,
      ),
    );
    throw e;
  } finally {
    await Promise.all(contexts.map((c) => c.dispose()));
    if (!previewReady) child?.kill();
    await sql.end();
  }
}
main().catch((e) => {
  console.error({ name: e.name, message: e.message.split("\nCall log:")[0] });
  process.exitCode = 1;
});
