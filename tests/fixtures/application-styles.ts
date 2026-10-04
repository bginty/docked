import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Opt in only after the coordinating task has finished the isolated production
// build. Fixtures still intercept mutations; this changes stylesheet provenance.
export async function applicationStyles(page: Page, sources: string[]) {
  if (process.env.DOCKED_QA_COMPILED_CSS === "1") {
    const response = await page.request.get("/notifications");
    if (!response.ok())
      throw Error("Compiled application document is unavailable.");
    const html = await response.text();
    const files = [...html.matchAll(/<link\b[^>]*>/g)]
      .filter(([tag]) => /\brel="stylesheet"/.test(tag))
      .map(([tag]) => /\bhref="([^"]+)"/.exec(tag)?.[1])
      .filter((file): file is string => Boolean(file));
    if (!files.length)
      throw Error("Compiled application styles are unavailable.");
    for (const file of files) {
      if (!/^\/_next\/static\/chunks\/[\w.-]+\.css$/.test(file))
        throw Error("Unexpected compiled stylesheet path.");
      await page.addStyleTag({
        content: await readFile(
          path.resolve(".next", file.slice("/_next/".length)),
          "utf8",
        ),
      });
    }
    return;
  }
  for (const file of sources)
    await page.addStyleTag({ path: path.resolve("src/app", file) });
}
