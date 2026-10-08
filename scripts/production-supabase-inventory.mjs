import { pathToFileURL } from "node:url";

export const productionOrganization = "otldyeunbqabbcjydjpe";
const projectName = "docked-production";
const apiOrigin = "https://api.supabase.com";
const excludedRefs = new Set(["bckkllmndoxzpzdqrevb", "dwdjeecjdkkiidoutnme"]);

/** Read-only discovery. No account-wide routes, credential-store reads, redirects,
 * billing changes, project creation or manifest approval. The optional transport
 * is only for isolated tests; the executable always uses the native fetch.
 * @param {{token: string | undefined, fetchImpl?: typeof fetch}} options */
export async function productionInventory({ token, fetchImpl = fetch }) {
  if (!token?.trim() || /[\r\n]/.test(token))
    throw Error(
      "SUPABASE_ACCESS_TOKEN is required through the local environment",
    );
  const get = async (path) => {
    let response;
    try {
      response = await fetchImpl(apiOrigin + path, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw Error("Scoped Supabase request failed; no fallback was attempted");
    }
    if (!response.ok)
      throw Error(`Scoped Supabase request refused (HTTP ${response.status})`);
    try {
      return await response.json();
    } catch {
      throw Error("Scoped Supabase response was not valid JSON");
    }
  };
  const projects = [];
  const seen = new Set();
  const limit = 50;
  let complete = false;
  let observedCount;
  for (let page = 0; page < 20; page++) {
    const offset = page * limit;
    const result = await get(
      `/v1/organizations/${productionOrganization}/projects?offset=${offset}&limit=${limit}`,
    );
    const pagination = result?.pagination;
    if (
      !Array.isArray(result?.projects) ||
      result.projects.length > limit ||
      pagination?.offset !== offset ||
      pagination?.limit !== limit ||
      !Number.isSafeInteger(pagination?.count) ||
      pagination.count < result.projects.length ||
      (observedCount !== undefined && observedCount !== pagination.count)
    )
      throw Error(
        "Incomplete or changing organization inventory; stop provisioning",
      );
    observedCount = pagination.count;
    for (const project of result.projects) {
      if (
        !/^[a-z]{20}$/.test(project?.ref ?? "") ||
        excludedRefs.has(project.ref) ||
        seen.has(project.ref) ||
        typeof project.name !== "string" ||
        typeof project.region !== "string" ||
        typeof project.status !== "string" ||
        typeof project.is_branch !== "boolean" ||
        (project.organization_id &&
          project.organization_id !== productionOrganization)
      )
        throw Error("Organization inventory failed identity validation");
      seen.add(project.ref);
      projects.push({
        ref: project.ref,
        name: project.name,
        region: project.region,
        status: project.status,
        isBranch: project.is_branch,
      });
    }
    if (result.projects.length < limit) {
      if (pagination.count !== projects.length)
        throw Error("Incomplete organization inventory; stop provisioning");
      complete = true;
      break;
    }
  }
  if (!complete)
    throw Error("Organization inventory exceeded its safe page limit");
  const matches = projects.filter((project) => project.name === projectName);
  if (matches.length > 1)
    throw Error(
      "Multiple docked-production projects; do not select or create one",
    );
  if (matches.length === 1) {
    const target = matches[0];
    const verified = await get(`/v1/projects/${target.ref}`);
    if (
      verified.id !== target.ref ||
      verified.organization_id !== productionOrganization ||
      verified.name !== projectName ||
      verified.region !== "ap-southeast-2" ||
      target.isBranch
    )
      throw Error(
        "Production project identity or Sydney region requires review",
      );
  }
  return {
    checkedAt: new Date().toISOString(),
    organizationId: productionOrganization,
    inventoryComplete: true,
    projectCount: projects.length,
    projects,
    productionProject: matches[0] ?? null,
    // An empty organization is not proof of a billing cap or permission to buy.
    billingVerified: false,
    readyToProvision: false,
    mutationsPerformed: false,
  };
}

async function main() {
  try {
    if (process.argv.length !== 2)
      throw Error("No command arguments are accepted");
    const report = await productionInventory({
      token: process.env.SUPABASE_ACCESS_TOKEN,
    });
    console.log(JSON.stringify(report, null, 2));
  } catch {
    // Never print provider bodies, tokens, raw network/parser errors or credential URLs.
    console.error(
      "Production organization inventory is blocked. Check the local token permission and scoped API access; no cloud changes were made.",
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main();
