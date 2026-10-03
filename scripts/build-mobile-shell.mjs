import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

// Capacitor's remote development mode serves errorPath locally, but not its
// sibling CSS/JS requests. Keep the error document self-contained and hash-bound.
const style = readFileSync("mobile/www/shell.css", "utf8").trim();
const script = readFileSync("mobile/www/offline.js", "utf8").trim();
const hash = (value) => createHash("sha256").update(value).digest("base64");
const csp = `default-src 'none'; style-src 'sha256-${hash(style)}'; script-src 'sha256-${hash(script)}'; base-uri 'none'; form-action 'none'`;
const html = readFileSync("mobile/offline.template.html", "utf8")
  .replace("{{CSP}}", csp)
  .replace("{{STYLE}}", style)
  .replace("{{SCRIPT}}", script);
writeFileSync("mobile/www/offline.html", html);
