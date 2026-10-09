import { netlifyCodeCommit } from "./hosting-identity.mjs";
const fullCommit = /^[a-f0-9]{40}$/i;
/** Deployment metadata is an operator/deployment-platform assertion, never a substitute for a reviewed artifact. */
export function deployedCodeCommit(
  env: Record<string, string | undefined>,
): string | null {
  if (env.NETLIFY || env.SITE_ID) return netlifyCodeCommit(env);
  const local = env.DOCKED_CODE_COMMIT;
  const deployed = env.VERCEL_GIT_COMMIT_SHA;
  if (
    (local && !fullCommit.test(local)) ||
    (deployed && !fullCommit.test(deployed))
  )
    return null;
  // On Vercel, require platform provenance; a manually entered local SHA cannot replace it.
  if (env.VERCEL === "1" && !deployed) return null;
  if (local && deployed && local.toLowerCase() !== deployed.toLowerCase())
    return null;
  return (deployed || local)?.toLowerCase() ?? null;
}
export function frozenCodeMatches(
  strategyCommit: unknown,
  env: Record<string, string | undefined>,
): boolean {
  const deployed = deployedCodeCommit(env);
  return (
    typeof strategyCommit === "string" &&
    fullCommit.test(strategyCommit) &&
    deployed !== null &&
    strategyCommit.toLowerCase() === deployed
  );
}
