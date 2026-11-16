/** Closed Preview preparation only. This module grants no SMS or Production authority. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
export const root = process.cwd();
export const evidence = root + "/docs/qa/final-commercial-20261116";
export const privateDir = root + "/private-data/final-commercial-20261116";
export const sourceCommit = "76df44ba1adef012c5ec2119563cbc05ff9e3c0b";
export const packageSha256 =
  "954e467e9e0a5a6e15db154eb03a055913823e067248470f556cf20f31092436";
export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
export const git = (...args) =>
  execFileSync("git", args, { cwd: root, windowsHide: true, maxBuffer: 256e6 });
export const blob = (file) => git("show", sourceCommit + ":" + file);
export function packet() {
  const bytes = readFileSync(
    evidence + "/../batch1-hosted-release-20261116/production-package.json",
  );
  assert.equal(hash(bytes), packageSha256);
  const p = JSON.parse(bytes);
  assert.equal(p.sourceCommit, sourceCommit);
  // This package identifies source only; Production approval remains pending.
  return { ...p, previewProject: "bckkllmndoxzpzdqrevb" };
}
export function authority(scope) {
  assert.equal(scope, "preview-stage");
  // Latest founder instruction explicitly authorises preparing protected staged
  // candidates. All provider/acceptance/registration/commerce flags remain OFF.
  // No open-window mode exists in this operator.
  return packet();
}
export function writeEvidence(name, value) {
  assert.match(name, /^[a-z0-9-]+\.json$/);
  mkdirSync(evidence, { recursive: true });
  writeFileSync(evidence + "/" + name, JSON.stringify(value, null, 2) + "\n", {
    flag: "wx",
  });
}
export function writePrivate(name, value) {
  assert.match(name, /^[a-z0-9.-]+$/);
  mkdirSync(privateDir, { recursive: true });
  writeFileSync(privateDir + "/" + name, JSON.stringify(value), {
    flag: "wx",
    mode: 0o600,
  });
}
