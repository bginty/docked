/** Test-only bundling of the actual route. Authentication is explicitly
 * simulated from a restored session; SQL admission/MFA/permissions still run.
 * No hosted URL, credential or product-source override is accepted at runtime.
 */
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

export async function batch1RouteFixture(baseline = false) {
  const root = process.cwd();
  const overrides = new Map<string, string>();
  if (baseline)
    for (const file of [
      "src/server/member-test-wallet.ts",
      "src/server/credits-sandbox-store.ts",
      "src/server/market-visibility.ts",
      "src/server/economy-catalogue.ts",
      "src/server/rate-limit-query.ts",
      "src/core/credits-sandbox.ts",
      "src/core/card-economy.ts",
    ]) {
      overrides.set(
        resolve(file),
        execFileSync(
          "git",
          ["show", `12ccfd5879ae83f1bd62210ee16a3feb6907d9ef:${file}`],
          { encoding: "utf8", windowsHide: true, maxBuffer: 4e6 },
        ),
      );
    }
  // Baseline route cannot import the newly added receipt projection entry point.
  if (baseline)
    overrides.set(
      resolve("src/app/api/test-wallet/route.ts"),
      execFileSync(
        "git",
        [
          "show",
          "12ccfd5879ae83f1bd62210ee16a3feb6907d9ef:src/app/api/test-wallet/route.ts",
        ],
        { encoding: "utf8", windowsHide: true },
      ),
    );
  const routePath = resolve("src/app/api/test-wallet/route.ts");
  // Diagnostic capture only; keep the actual error response/rejection semantics.
  overrides.set(
    routePath,
    `import {context as diagnosticContext} from 'batch1-context';\n` +
      (overrides.get(routePath) ?? readFileSync(routePath, "utf8")).replaceAll(
        "} catch (error) {",
        "} catch (error) { diagnosticContext().errors?.push({message:error?.message,code:error?.code});",
      ),
  );
  const ctx = `import {AsyncLocalStorage} from 'node:async_hooks';
    const scope=new AsyncLocalStorage();
    export const run=(value,work)=>scope.run(value,work);
    export const context=()=>{const v=scope.getStore();if(!v)throw Error('Isolated request scope required');return v};`;
  const db = `import {context} from 'batch1-context';
    import {betaSql} from '${resolve("src/server/beta-sql.ts").replaceAll("\\", "/")}';
    import {rateLimitQuery} from '${resolve("src/server/rate-limit-query.ts").replaceAll("\\", "/")}';
    export const db=()=>betaSql(context().sql);
    export async function rateLimitStatus(key,limit,seconds){const [r]=await db().unsafe(rateLimitQuery,[key,seconds]);return {allowed:r.count<=limit,retryAfterSeconds:r.retry_after_seconds}};
    export async function rateLimit(key,limit=20,seconds=60){return (await rateLimitStatus(key,limit,seconds)).allowed};`;
  const auth = `import {context} from 'batch1-context';
    export async function requireIdentity(){return context().who};
    export async function identity(){return context().who};
    export async function requireRole(){throw Error('Role escalation is outside this isolated fixture')};
    export async function authClient(){throw Error('Real Auth is outside this isolated fixture')};
    export const sameOrigin=(request)=>new URL(request.url).origin==='http://127.0.0.1:3033';`;
  const out = resolve(
    `tmp/batch1/route-${baseline ? "baseline" : "candidate"}.cjs`,
  );
  mkdirSync(resolve("tmp/batch1"), { recursive: true });
  await build({
    absWorkingDir: root,
    stdin: {
      contents: `export {POST,GET} from './src/app/api/test-wallet/route';export {run} from 'batch1-context';
      import {context} from 'batch1-context';import {db} from './src/server/db';
      import {CreditsSandboxStore} from './src/server/credits-sandbox-store';
      import {setCommunityClaims} from './src/server/community-social';
      export async function fixtureFunding(){const who=context().who;
        if(process.env.DOCKED_LOCAL_MARKETPLACE_ACCEPTANCE!=='true')throw Error('Isolated fixture required');
        return new CreditsSandboxStore(db(),async tx=>{await setCommunityClaims(tx,who);await tx\`select beta_packs.assert_grant(\${who.user.id}::uuid)\`;})
          .execute({id:who.user.id,role:'reviewer',aal:'aal2'},'e89029cc-41d2-4ed9-ad87-9928ea5ba70b',
            {kind:'promotion',member:who.user.id,amount:1000,campaign:'batch1-isolated-benchmark-only',reason:'Isolated rollback-only benchmark funding; no real credit grant',confirmed:true,redeemable:false});
      }`,
      resolveDir: root,
    },
    outfile: out,
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
    plugins: [
      {
        name: "isolated-restored-route",
        setup(b) {
          b.onResolve({ filter: /^batch1-context$|^server-only$/ }, (args) => ({
            path: args.path,
            namespace: "batch1",
          }));
          b.onLoad({ filter: /.*/, namespace: "batch1" }, (args) => ({
            contents: args.path === "batch1-context" ? ctx : "",
            loader: "ts",
          }));
          b.onLoad(
            { filter: /[/\\]src[/\\]server[/\\](auth|db)\.ts$/ },
            (args) => ({
              contents: /[/\\]auth\.ts$/.test(args.path) ? auth : db,
              loader: "ts",
            }),
          );
          b.onLoad({ filter: /\.(ts|tsx)$/ }, (args) =>
            overrides.has(args.path)
              ? {
                  contents: overrides.get(args.path)!,
                  loader: args.path.endsWith("tsx") ? "tsx" : "ts",
                }
              : undefined,
          );
        },
      },
    ],
  });
  const require = createRequire(resolve("package.json"));
  delete require.cache[out];
  return require(out) as {
    POST: (request: Request) => Promise<Response>;
    fixtureFunding: () => Promise<unknown>;
    run: <T>(value: unknown, work: () => T) => T;
  };
}
