import { readFile, readdir, lstat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { gunzipSync, brotliDecompressSync } from "node:zlib";

const maxFileBytes = 128 * 1024 * 1024;
const credentialName =
  /(?:SECRET|PASSWORD|PASSWD|TOKEN|API_KEY|PRIVATE_KEY|DATABASE_URL|PGPASSWORD)/i;
const knownSources = [
  "private-data/hosted-preview/connection.json",
  ".env.local",
];
const signatures = [
  /\bsb_secret_[A-Za-z0-9_-]{16,}\b/g,
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/g,
  /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{30,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/g,
  /\bDOCKED_BUILD_CANARY_[A-Z0-9_]+\b/g,
  /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?|smtps?|https?):\/\/[^\s/:@"'<>]+:[^\s/@"'<>]+@/gi,
];

function isPublicValue(value) {
  if (value.startsWith("sb_publishable_")) return true;
  const pieces = value.split(".");
  if (pieces.length !== 3) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(pieces[1], "base64url").toString("utf8"),
    );
    return payload.role === "anon" && !payload.session_id;
  } catch {
    return false;
  }
}
function addSecret(values, value) {
  if (typeof value !== "string" || !value.trim() || isPublicValue(value))
    return;
  // Do not silently ignore short configured passwords. They can cause more
  // findings, which is preferable to certifying an incomplete scan.
  values.add(value);
  if (
    /^(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?|smtps?):\/\//i.test(
      value,
    )
  ) {
    try {
      const password = new URL(value).password;
      if (password) {
        values.add(password);
        values.add(decodeURIComponent(password));
      }
    } catch {
      throw new Error("KNOWN_SOURCE_INVALID");
    }
  }
}

/** Literal parser only: never execute shell syntax or expand environment references. */
function parseEnv(content) {
  const entries = [];
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const match = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/,
    );
    if (!match) throw new Error("KNOWN_SOURCE_INVALID");
    let value = match[2].trim();
    if (value.startsWith('"')) {
      const quoted = value.match(/^"(?:[^"\\]|\\.)*"(?=\s*(?:#.*)?$)/);
      if (!quoted) throw new Error("KNOWN_SOURCE_INVALID");
      try {
        value = JSON.parse(quoted[0]);
      } catch {
        throw new Error("KNOWN_SOURCE_INVALID");
      }
    } else if (value.startsWith("'")) {
      const quoted = value.match(/^'([^']*)'\s*(?:#.*)?$/);
      if (!quoted) throw new Error("KNOWN_SOURCE_INVALID");
      value = quoted[1];
    } else value = value.split("#")[0].trim();
    entries.push([match[1], value]);
  }
  return entries;
}

/** Only these two operator-authorised paths are read for comparison values. */
export async function loadKnownSecrets(root = process.cwd()) {
  const values = new Set();
  let filesLoaded = 0;
  for (const relative of knownSources) {
    let content;
    try {
      const file = path.join(root, relative),
        info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink() || info.size > maxFileBytes)
        throw new Error("invalid");
      content = await readFile(file, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw new Error("KNOWN_SOURCE_UNREADABLE");
    }
    try {
      if (relative.endsWith(".json")) {
        const value = JSON.parse(content);
        if (!value || typeof value !== "object" || Array.isArray(value))
          throw new Error("invalid");
        for (const name of [
          "secretKey",
          "serviceRoleKey",
          "databasePassword",
          "databaseUrl",
        ])
          if (value[name] !== undefined) {
            if (typeof value[name] !== "string") throw new Error("invalid");
            addSecret(values, value[name]);
          }
      } else {
        for (const [name, value] of parseEnv(content))
          if (credentialName.test(name)) addSecret(values, value);
      }
      filesLoaded++;
    } catch {
      // JSON and parser errors can contain the input. Never relay them.
      throw new Error("KNOWN_SOURCE_INVALID");
    }
  }
  if (!values.size) throw new Error("NO_KNOWN_SECRET_VALUES");
  return { values: [...values], filesLoaded };
}

function variants(value) {
  const escaped = JSON.stringify(value).slice(1, -1);
  const html = value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
  const unicode = [...value]
    .map((c) =>
      [...Buffer.from(c, "utf16le")].reduce(
        (s, v, i, a) =>
          i % 2
            ? s
            : s + `\\u${(v + a[i + 1] * 256).toString(16).padStart(4, "0")}`,
        "",
      ),
    )
    .join("");
  const htmlJson = escaped
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
  return [
    ...new Set([
      value,
      escaped,
      htmlJson,
      encodeURIComponent(value),
      html,
      unicode,
      Buffer.from(value).toString("base64"),
      Buffer.from(value).toString("base64url"),
    ]),
  ].flatMap((v) => [Buffer.from(v, "utf8"), Buffer.from(v, "utf16le")]);
}
function genericMatches(text) {
  let count = 0;
  for (const signature of signatures)
    count += [...text.matchAll(signature)].length;
  for (const match of text.matchAll(
    /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{10,}\b/g,
  ))
    if (!isPublicValue(match[0])) count++;
  // Env/JSON credential assignments need a literal value. Variable names and
  // process.env references in reviewed source code are not credential leaks.
  for (const match of text.matchAll(
    /["']?([A-Z][A-Z0-9_]*(?:SECRET|PASSWORD|PASSWD|TOKEN|API_KEY|PRIVATE_KEY)[A-Z0-9_]*)["']?\s*[:=]\s*["']([^"'\r\n]{8,})["']/g,
  ))
    if (!isPublicValue(match[2])) count++;
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*([^\s"'#][^\r\n]*)$/,
    );
    if (
      match &&
      credentialName.test(match[1]) &&
      match[2].trim().length >= 8 &&
      !isPublicValue(match[2].trim())
    )
      count++;
  }
  return count;
}

/** Returns counts only. Never returns a matched value or source snippet. */
export function inspectSecretBytes(bytes, secretValues = []) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const exactMatches = secretValues.filter(
    (value) =>
      typeof value === "string" &&
      value.length &&
      !isPublicValue(value) &&
      variants(value).some((v) => buffer.includes(v)),
  ).length;
  const patternMatches =
    genericMatches(buffer.toString("utf8")) +
    genericMatches(buffer.toString("utf16le")) +
    genericMatches(buffer.subarray(1).toString("utf16le"));
  return { exactMatches, patternMatches };
}

function archiveBytes(bytes) {
  return (
    [
      [0x50, 0x4b, 0x03, 0x04],
      [0x50, 0x4b, 0x05, 0x06],
      [0x50, 0x4b, 0x07, 0x08],
      [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c],
      [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07],
    ].some((signature) =>
      bytes.subarray(0, signature.length).equals(Buffer.from(signature)),
    ) || bytes.subarray(257, 262).toString("ascii") === "ustar"
  );
}

/** Explicit artifacts only; links/archives/unreadable/oversized inputs fail closed. */
export async function auditPreviewTargets(
  targets,
  secrets,
  root = process.cwd(),
) {
  const findings = [],
    errors = [],
    seen = new Set();
  let filesScanned = 0,
    bytesScanned = 0;
  function filename(file) {
    const relative = path.relative(root, file).replaceAll("\\", "/");
    const matches = inspectSecretBytes(Buffer.from(relative), secrets);
    return matches.exactMatches || matches.patternMatches
      ? `[redacted-path-${createHash("sha256").update(relative).digest("hex").slice(0, 12)}]`
      : relative;
  }
  async function inspect(file) {
    const absolute = path.resolve(root, file);
    if (seen.has(absolute)) return;
    seen.add(absolute);
    const label = filename(absolute);
    try {
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) {
        errors.push({ file: label, code: "SYMLINK_REFUSED" });
        return;
      }
      if (info.isDirectory()) {
        for (const entry of (await readdir(absolute)).sort())
          await inspect(path.join(absolute, entry));
        return;
      }
      if (!info.isFile() || info.size > maxFileBytes) {
        errors.push({ file: label, code: "UNSUPPORTED_OR_OVERSIZED_FILE" });
        return;
      }
      let bytes = await readFile(absolute);
      if (
        /\.(?:apk|aab|zip|jar|aar|7z|tar|tgz)$/i.test(absolute) ||
        archiveBytes(bytes)
      ) {
        errors.push({ file: label, code: "EXTRACT_ARCHIVE_BEFORE_SCANNING" });
        return;
      }
      if (/\.gz$/i.test(absolute) || (bytes[0] === 0x1f && bytes[1] === 0x8b))
        bytes = gunzipSync(bytes, { maxOutputLength: maxFileBytes });
      if (/\.br$/i.test(absolute))
        bytes = brotliDecompressSync(bytes, { maxOutputLength: maxFileBytes });
      // Decompression can reveal another container. Never certify its still-
      // compressed entries as scanned content; the operator must extract it.
      if (archiveBytes(bytes) || (bytes[0] === 0x1f && bytes[1] === 0x8b)) {
        errors.push({ file: label, code: "EXTRACT_ARCHIVE_BEFORE_SCANNING" });
        return;
      }
      const counts = inspectSecretBytes(bytes, secrets);
      filesScanned++;
      bytesScanned += bytes.length;
      if (counts.exactMatches || counts.patternMatches)
        findings.push({ file: label, ...counts });
    } catch {
      errors.push({ file: label, code: "UNREADABLE_OR_INVALID_FILE" });
    }
  }
  if (!Array.isArray(targets) || !targets.length)
    errors.push({ file: "", code: "EXPLICIT_TARGET_REQUIRED" });
  else for (const target of targets) await inspect(target);
  if (!filesScanned) errors.push({ file: "", code: "NO_FILES_SCANNED" });
  return {
    status: findings.length || errors.length ? "FAIL" : "PASS",
    filesScanned,
    bytesScanned,
    findings,
    errors,
  };
}

async function main() {
  const targets = process.argv.slice(2);
  if (targets.length === 1 && targets[0] === "--help") {
    console.log(
      "Usage: node scripts/audit-preview-secrets.mjs <deployment-source-directory> <.next/static> <rendered-html-or-rsc> <extracted-apk-directory>\nRead-only. Uses only .env.local and private-data/hosted-preview/connection.json for exact comparison. Output contains filenames/counts only. Extract archives first; empty or unreadable inputs fail.",
    );
    return;
  }
  try {
    const known = await loadKnownSecrets();
    const report = await auditPreviewTargets(targets, known.values);
    console.log(
      JSON.stringify(
        {
          ...report,
          knownSourceFiles: known.filesLoaded,
          knownSecretValues: known.values.length,
        },
        null,
        2,
      ),
    );
    process.exitCode = report.status === "PASS" ? 0 : 1;
  } catch (error) {
    const permitted = [
      "KNOWN_SOURCE_INVALID",
      "KNOWN_SOURCE_UNREADABLE",
      "NO_KNOWN_SECRET_VALUES",
    ];
    console.log(
      JSON.stringify(
        {
          status: "FAIL",
          filesScanned: 0,
          findings: [],
          errors: [
            {
              file: "",
              code: permitted.includes(error?.message)
                ? error.message
                : "AUDIT_FAILED",
            },
          ],
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}
if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
)
  void main();
