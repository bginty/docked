import path from "node:path";

/** New acceptance runs can preserve earlier milestone evidence unchanged. */
export const evidenceRoot = path.resolve(
  process.env.DOCKED_QA_ROOT ?? "docs/qa/phase4",
);
