import type { FullConfig } from "@playwright/test";
import { fixture, check } from "./guard";
export default async function setup(config: FullConfig) {
  await fixture();
  check(config.workers === 1, "one-worker-required");
  for (const project of config.projects) {
    check(
      project.use.trace === "off" &&
        project.use.video === "off" &&
        project.use.screenshot === "off",
      "secret-bearing-artifacts-disabled",
    );
    check(project.retries === 0, "no-automatic-account-retries");
  }
}
