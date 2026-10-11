import { productionHostCommit } from "./hosting-identity.mjs";
import { assertHostedBeta } from "./hosted-beta.mjs";
import friends from "../../config/friends-release.json" with { type: "json" };

/** Friends provenance must describe the isolated beta target, never the retired
 * commercial-host manifest. This does not certify a browser acceptance pass.
 * @param {Record<string,string|undefined>} env
 * @param {Record<string,any>} [receipt] */
export function friendsReleaseIdentity(env, receipt = friends) {
  if (
    env.DOCKED_FRIENDS_BETA !== "true" ||
    !assertHostedBeta(env, receipt) ||
    !/^dpl_[A-Za-z0-9]{16,80}$/.test(env.VERCEL_DEPLOYMENT_ID ?? "")
  )
    throw Error("Friends deployment identity unavailable");
  return {
    hostingProvider: "vercel",
    siteId: env.VERCEL_PROJECT_ID,
    hostingAccountId: env.VERCEL_ORG_ID,
    commit: env.VERCEL_GIT_COMMIT_SHA,
    deploymentId: env.VERCEL_DEPLOYMENT_ID,
    projectRef: "pojoymtniryarxxunyvz",
  };
}

/** Public provenance only, not acceptance evidence. The route must first run
 * the production approval/auth guards.
 * @param {Record<string,string|undefined>} env
 * @param {Record<string,any>} manifest
 * @param {Record<string,any>} build */
export function betaReleaseIdentity(env, manifest, build) {
  const commit = productionHostCommit(env, manifest, build);
  if (!commit) throw Error("Production commit unavailable");
  if (manifest.hostingProvider === "netlify")
    return {
      hostingProvider: "netlify",
      siteId: manifest.netlifySiteId,
      hostingAccountId: manifest.netlifyAccountId,
      commit,
      deploymentId: build.deployId,
    };
  if (!/^dpl_[A-Za-z0-9]{16,80}$/.test(env.VERCEL_DEPLOYMENT_ID ?? ""))
    throw Error("Production deployment identity unavailable");
  return {
    hostingProvider: "vercel",
    siteId: manifest.vercelProjectId,
    hostingAccountId: manifest.vercelTeamId,
    commit,
    deploymentId: env.VERCEL_DEPLOYMENT_ID,
  };
}
