import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolveAndroidTarget } from "./android-preview-config.mjs";

// Capacitor's remote development mode serves errorPath locally, but not its
// sibling CSS/JS requests. Keep the error document self-contained and hash-bound.
const hash = (value) => createHash("sha256").update(value).digest("base64");
const brand = JSON.parse(readFileSync("src/brand/brand-tokens.json", "utf8"));
const canonical = JSON.parse(
  readFileSync("src/brand/canonical-logo.json", "utf8"),
);
const fantasy = process.env.FANTASY_CARDS_PREVIEW === "true";
const logo = `data:image/png;base64,${readFileSync(fantasy ? "public/brand/docked/icons/docked-icon-512.png" : canonical.source).toString("base64")}`;
function shellStyle() {
  const variables = Object.entries(brand.colors)
    .map(([name, value]) => `--brand-${name}:${value}`)
    .join(";");
  // HTML parsing normalises CRLF to LF before CSP evaluates inline hashes.
  // Emit and hash the same canonical bytes on Windows and Unix.
  return `:root{${variables};--brand-font:${brand.fontFamily}}\n${readFileSync("mobile/www/shell.css", "utf8").replace(/\r\n?/g, "\n").trim()}`;
}
function brandShell(template) {
  return template
    .replaceAll("{{NAVY}}", brand.colors.navy)
    .replaceAll("{{LOGO}}", logo)
    .replaceAll(
      "{{TAGLINE}}",
      fantasy ? "COLLECT. BUILD. COMPETE." : brand.tagline,
    );
}
export function renderPublicOfflineShell() {
  return brandShell(
    readFileSync("mobile/pwa-offline.template.html", "utf8"),
  ).replace("{{STYLE}}", shellStyle());
}
export function renderOfflineShell(target) {
  const style = shellStyle();
  const script = readFileSync("mobile/www/offline.js", "utf8")
    .replace(/\r\n?/g, "\n")
    .trim()
    .replace("__DOCKED_RETRY_URL__", JSON.stringify(target.entryUrl));
  const csp = `default-src 'none'; img-src data:; style-src 'sha256-${hash(style)}'; script-src 'sha256-${hash(script)}'; base-uri 'none'; form-action 'none'`;
  return brandShell(readFileSync("mobile/offline.template.html", "utf8"))
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
      : brandShell(readFileSync("mobile/www/index.html", "utf8")),
  );
  writeFileSync(`${target.webDir}/shell.css`, shellStyle());
  if (target.manifest)
    writeFileSync(
      `${target.webDir}/preview-environment.json`,
      JSON.stringify(target.manifest, null, 2) + "\n",
    );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  buildMobileShell();
