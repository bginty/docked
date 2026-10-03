import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolveAndroidTarget } from "./android-preview-config.mjs";

// Capacitor's remote development mode serves errorPath locally, but not its
// sibling CSS/JS requests. Keep the error document self-contained and hash-bound.
const hash = (value) => createHash("sha256").update(value).digest("base64");
export function renderOfflineShell(target) {
  const style = readFileSync("mobile/www/shell.css", "utf8").trim();
  const script = readFileSync("mobile/www/offline.js", "utf8")
    .trim()
    .replace("__DOCKED_RETRY_URL__", JSON.stringify(target.entryUrl));
  const csp = `default-src 'none'; style-src 'sha256-${hash(style)}'; script-src 'sha256-${hash(script)}'; base-uri 'none'; form-action 'none'`;
  return readFileSync("mobile/offline.template.html", "utf8")
    .replace("{{CSP}}", csp)
    .replace("{{STYLE}}", style)
    .replace("{{SCRIPT}}", script)
    .replace(
      "{{RETRY_LABEL}}",
      target.mode === "local" ? "Retry local preview" : "Retry Docked Preview",
    )
    .replace("{{RETRY_DISABLED}}", target.entryUrl ? "" : "disabled")
    .replace(
      "{{CONNECTION_MESSAGE}}",
      target.entryUrl
        ? "Check your Wi-Fi or mobile data connection, then try again."
        : "This developer build has no configured preview connection.",
    );
}
export function buildMobileShell(target = resolveAndroidTarget()) {
  mkdirSync(target.webDir, { recursive: true });
  const html = renderOfflineShell(target);
  writeFileSync(`${target.webDir}/offline.html`, html);
  writeFileSync(
    `${target.webDir}/index.html`,
    target.mode === "hosted"
      ? html
      : readFileSync("mobile/www/index.html", "utf8"),
  );
  writeFileSync(
    `${target.webDir}/shell.css`,
    readFileSync("mobile/www/shell.css"),
  );
  if (target.manifest)
    writeFileSync(
      `${target.webDir}/preview-environment.json`,
      JSON.stringify(target.manifest, null, 2) + "\n",
    );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  buildMobileShell();
