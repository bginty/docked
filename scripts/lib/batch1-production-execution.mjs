/** Current founder authority and exact immutable release verification. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
export const root = process.cwd(),
  docs = root + "/docs/qa/batch1-production-execution-20261116",
  priv = root + "/private-data/batch1-production-execution-20261116";
export const source = "76df44ba1adef012c5ec2119563cbc05ff9e3c0b",
  packageSha =
    "954e467e9e0a5a6e15db154eb03a055913823e067248470f556cf20f31092436",
  addendumSha =
    "d11dc58f8ae13f542b4ad03499ea46a9f9afeb635c95bab526b263b3b4c8ee0e";
export const sha = (b) => createHash("sha256").update(b).digest("hex");
export const json = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
export const save = (p, v) =>
  fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n", { mode: 0o600 });
export function authority() {
  const a = json(priv + "/authority.private.json");
  assert.equal(a.source, source);
  assert.equal(a.packageSha, packageSha);
  assert.equal(a.addendumSha, addendumSha);
  assert(a.originalApproved && a.addendumApproved);
  assert(Date.now() < Date.parse(a.expiresAt));
  assert.equal(
    sha(fs.readFileSync(docs + "/RUNTIME_PRESERVATION_ADDENDUM.txt")),
    addendumSha,
  );
}
export function packet() {
  const b = fs.readFileSync(
    root + "/docs/qa/batch1-hosted-release-20261116/production-package.json",
  );
  assert.equal(sha(b), packageSha);
  const p = JSON.parse(b);
  assert.equal(p.sourceCommit, source);
  for (const f of p.migrations)
    assert.equal(sha(fs.readFileSync(root + "/" + f.file)), f.sha256);
  return p;
}
export function verifyExport() {
  const p = packet(),
    exportRoot = path.resolve(priv, "source");
  for (const f of p.sourceFiles) {
    const file = path.resolve(exportRoot, f.file);
    assert(file.startsWith(exportRoot + path.sep));
    assert.equal(sha(fs.readFileSync(file)), f.sha256, f.file);
  }
  return p.sourceFiles.length;
}
export function sourceBlob(file) {
  const p = packet(),
    f =
      p.sourceFiles.find((f) => f.file === file) ??
      p.migrations.find((f) => f.file === file);
  assert(f);
  const b = execFileSync("git", ["show", source + ":" + file], {
    windowsHide: true,
    maxBuffer: 32e6,
  });
  assert.equal(sha(b), f.sha256);
  return b;
}
