import { test } from "node:test";
import assert from "node:assert/strict";
import {
  productionInventory,
  productionOrganization,
} from "../../scripts/production-supabase-inventory.mjs";

const token = "authored-local-test-token";
const ref = "abcdefghijklmnopqrst";
const project = {
  ref,
  name: "docked-production",
  region: "ap-southeast-2",
  status: "ACTIVE_HEALTHY",
  is_branch: false,
};
const page = (projects: unknown[], count = projects.length, offset = 0) => ({
  projects,
  pagination: { count, offset, limit: 50 },
});
function transport(bodies: unknown[], requests: string[] = []) {
  return (async (url: string | URL | Request, options?: RequestInit) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.origin, "https://api.supabase.com");
    assert.equal(options?.method, "GET");
    assert.equal(options?.redirect, "error");
    assert.ok(
      parsed.pathname ===
        `/v1/organizations/${productionOrganization}/projects` ||
        parsed.pathname === `/v1/projects/${ref}`,
    );
    assert.notEqual(parsed.pathname, "/v1/projects");
    requests.push(String(url));
    assert.ok(bodies.length);
    return Response.json(bodies.shift());
  }) as typeof fetch;
}

test("scoped inventory finds an empty organization without granting provisioning or billing approval", async () => {
  const requests: string[] = [];
  const result = await productionInventory({
    token,
    fetchImpl: transport([page([])], requests),
  });
  assert.equal(requests.length, 1);
  assert.equal(result.projectCount, 0);
  assert.equal(result.productionProject, null);
  assert.equal(result.billingVerified, false);
  assert.equal(result.readyToProvision, false);
});

test("existing production project must independently match the approved organization and Sydney", async () => {
  const verified = {
    id: ref,
    name: project.name,
    organization_id: productionOrganization,
    region: "ap-southeast-2",
  };
  const result = await productionInventory({
    token,
    fetchImpl: transport([page([project]), verified]),
  });
  assert.equal(result.productionProject?.ref, ref);
  for (const change of [
    { organization_id: "unrelated" },
    { region: "us-east-1" },
    { id: "zyxwvutsrqponmlkjihgf" },
  ])
    await assert.rejects(
      productionInventory({
        token,
        fetchImpl: transport([page([project]), { ...verified, ...change }]),
      }),
    );
});

test("inventory rejects excluded projects, duplicate matches, malformed pages and incomplete pagination", async () => {
  for (const body of [
    page([{ ...project, ref: "bckkllmndoxzpzdqrevb" }]),
    page([{ ...project, ref: "dwdjeecjdkkiidoutnme" }]),
    page([project, { ...project, ref: "zyxwvutsrqponmlkjihgf" }]),
    page([project], 2),
    { projects: [] },
    page([], 0, 50),
  ])
    await assert.rejects(
      productionInventory({ token, fetchImpl: transport([body]) }),
    );
});

test("a target on a later page is found without account-wide discovery or following server URLs", async () => {
  const first = Array.from({ length: 50 }, (_, i) => ({
    ...project,
    name: `other-${i}`,
    ref:
      "a".repeat(18) +
      String.fromCharCode(97 + Math.floor(i / 26), 97 + (i % 26)),
  }));
  const requests: string[] = [];
  const result = await productionInventory({
    token,
    fetchImpl: transport(
      [
        { ...page(first, 51), next: "https://untrusted.invalid/all-projects" },
        page([project], 51, 50),
        {
          id: ref,
          name: project.name,
          organization_id: productionOrganization,
          region: "ap-southeast-2",
        },
      ],
      requests,
    ),
  });
  assert.equal(result.projectCount, 51);
  assert.match(requests[1], /offset=50&limit=50/);
  assert.equal(requests.length, 3);
});

test("missing credentials and transport/provider failures never trigger fallback or leak provider error bodies", async () => {
  await assert.rejects(
    productionInventory({ token: undefined, fetchImpl: transport([]) }),
  );
  await assert.rejects(
    productionInventory({
      token,
      fetchImpl: (async () => {
        throw Error(token);
      }) as typeof fetch,
    }),
    (error) => !String(error).includes(token),
  );
  await assert.rejects(
    productionInventory({
      token,
      fetchImpl: (async () =>
        new Response(token, { status: 403 })) as typeof fetch,
    }),
    (error) => !String(error).includes(token),
  );
});
