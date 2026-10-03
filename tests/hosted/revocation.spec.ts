import { test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { api, check, expect, login, privateRead, PROJECT } from "./helpers";
test("existing member loses community access after actual QA policy revocation", async ({
  page,
}) => {
  const proof = await privateRead<{
    projectRef: string;
    policyRevokedAt: string;
  }>("policy-revocation.json");
  check(
    proof.projectRef === PROJECT &&
      Date.parse(proof.policyRevokedAt) <= Date.now() &&
      Date.parse(proof.policyRevokedAt) > Date.now() - 1800000,
    "root-proven-current-policy-revocation",
  );
  await login(page, "memberB");
  check(
    (await api(page, "/api/member")).status === 200,
    "revoked-community-preserves-account-export",
  );
  const feed = await api(page, "/api/community?tab=latest");
  check(
    feed.json?.status === "restricted" && feed.json?.posts?.length === 0,
    "revoked-policy-hides-community-feed",
  );
  check(
    (
      await api(page, "/api/community", {
        action: "post",
        kind: "discussion",
        body: "Revoked policy probe must not be stored.",
        idempotencyKey: randomUUID(),
      })
    ).status === 403,
    "revoked-policy-api-write-denied",
  );
  await page.goto("/compose");
  await expect(
    page.getByRole("button", { name: "Publish social post" }),
  ).toHaveCount(0);
});
