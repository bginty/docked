import { productionHostCommit } from "./hosting-identity.mjs";

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
