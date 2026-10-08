import recordedBuild from "../../config/netlify-build.json" with { type: "json" };

const commitPattern = /^[a-f0-9]{40}$/i;
const sitePattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
/** @param {Record<string, any>} manifest */
export function reviewedHostingIdentity(manifest) {
  if (manifest.hostingProvider === "netlify")
    return (
      sitePattern.test(manifest.netlifySiteId ?? "") &&
      /^[A-Za-z0-9_-]{8,80}$/.test(manifest.netlifyAccountId ?? "")
    );
  return (
    (!manifest.hostingProvider || manifest.hostingProvider === "vercel") &&
    /^prj_[A-Za-z0-9]+$/.test(manifest.vercelProjectId ?? "") &&
    /^team_[A-Za-z0-9]+$/.test(manifest.vercelTeamId ?? "") &&
    manifest.vercelProjectId !== "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR"
  );
}

/** Non-secret metadata generated only after the hosted build guard succeeds.
 * @param {Record<string, string | undefined>} env */
export function netlifyBuildCandidate(env) {
  if (
    env.NETLIFY !== "true" ||
    env.CONTEXT !== "production" ||
    env.NETLIFY_PREVIEW_SERVER
  )
    throw Error(
      "Only reviewed Netlify production builds can create deployment provenance",
    );
  return {
    schemaVersion: 1,
    provider: "netlify",
    siteId: env.SITE_ID,
    accountId: env.ACCOUNT_ID,
    context: env.CONTEXT,
    commit: env.COMMIT_REF,
    deployId: env.DEPLOY_ID,
  };
}

/** Netlify's commit/context variables are build-only; never invent them at runtime.
 * @param {Record<string, string | undefined>} env
 * @param {Record<string, any>} build */
export function netlifyCodeCommit(env, build = recordedBuild) {
  if (
    build.schemaVersion !== 1 ||
    build.provider !== "netlify" ||
    build.context !== "production" ||
    !sitePattern.test(build.siteId ?? "") ||
    env.SITE_ID !== build.siteId ||
    !commitPattern.test(build.commit ?? "") ||
    !/^[a-f0-9]{24}$/i.test(build.deployId ?? "") ||
    env.VERCEL === "1" ||
    env.VERCEL_ENV ||
    env.NETLIFY_PREVIEW_SERVER ||
    (env.NETLIFY && env.NETLIFY !== "true") ||
    (env.CONTEXT && env.CONTEXT !== "production") ||
    (env.COMMIT_REF &&
      env.COMMIT_REF.toLowerCase() !== build.commit.toLowerCase()) ||
    (env.DEPLOY_ID && env.DEPLOY_ID !== build.deployId) ||
    (env.DOCKED_CODE_COMMIT &&
      env.DOCKED_CODE_COMMIT.toLowerCase() !== build.commit.toLowerCase())
  )
    return null;
  return build.commit.toLowerCase();
}

/** @param {Record<string, string | undefined>} env
 * @param {Record<string, any>} manifest
 * @param {Record<string, any>} build */
export function productionHostCommit(env, manifest, build = recordedBuild) {
  if (!reviewedHostingIdentity(manifest)) return null;
  if (manifest.hostingProvider === "netlify") {
    if (
      build.siteId !== manifest.netlifySiteId ||
      build.accountId !== manifest.netlifyAccountId ||
      (env.ACCOUNT_ID && env.ACCOUNT_ID !== manifest.netlifyAccountId)
    )
      return null;
    return netlifyCodeCommit(env, build);
  }
  if (
    env.NETLIFY ||
    env.SITE_ID ||
    env.VERCEL !== "1" ||
    env.VERCEL_ENV !== "production" ||
    (env.VERCEL_TARGET_ENV && env.VERCEL_TARGET_ENV !== "production") ||
    env.VERCEL_PROJECT_ID !== manifest.vercelProjectId ||
    !commitPattern.test(env.VERCEL_GIT_COMMIT_SHA ?? "")
  )
    return null;
  return env.VERCEL_GIT_COMMIT_SHA.toLowerCase();
}
