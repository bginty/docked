/** Renders the single reviewed plain-text report; no application files changed. */
import fs from "node:fs";
const root = "docs/qa/overnight-audit-20261115";
const escape = (s) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const source = fs.readFileSync(root + "/MORNING_REPORT.txt", "utf8");
const paragraphs = source.trim().split(/\r?\n\s*\r?\n/);
const sections = [];
const parts = paragraphs.map((block, i) => {
  const lines = block.split(/\r?\n/);
  if (i === 0)
    return `<header><p class="eyebrow">DOCKED · 16 NOVEMBER 2026</p><h1>Application audit &amp; improvement plan</h1><p class="status">Public launch: NO-GO · Review only</p><p>Production <code>12ccfd58</code> · No product or Production changes</p></header>`;
  if (
    /^[A-I]\. /.test(lines[0]) ||
    ["KNOWN ACCESS AND EVIDENCE LIMITS", "EVIDENCE INDEX"].includes(lines[0])
  ) {
    const id = "section-" + sections.length;
    sections.push({ id, title: lines[0] });
    return (
      `<h2 id="${id}">${escape(lines[0])}</h2>` +
      (lines.length > 1 ? `<p>${escape(lines.slice(1).join(" "))}</p>` : "")
    );
  }
  if (/^P[0-3]-\d+/.test(lines[0]))
    return `<section class="recommendation"><h3>${escape(lines[0])}</h3><p class="lines">${escape(lines.slice(1).join("\n"))}</p></section>`;
  if (/\S {3,}\S/.test(block)) return `<pre>${escape(block)}</pre>`;
  if (/^\d+\. |^- |^Recommended batches/.test(block))
    return `<div class="lines block">${escape(block)}</div>`;
  const text = escape(lines.join(" ")).replace(
    /https:\/\/[^\s]+/g,
    (url) => `<a href="${url}">${url}</a>`,
  );
  return `<p>${text}</p>`;
});
const nav = sections
  .map((s) => `<a href="#${s.id}">${escape(s.title)}</a>`)
  .join("");
const appendix = escape(fs.readFileSync(root + "/TEST_RESULTS.txt", "utf8"));
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Docked — Application audit</title><style>
:root{font:17px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;color:#182839;background:#eef2f6}*{box-sizing:border-box}body{margin:0}main{overflow-wrap:anywhere;max-width:1050px;margin:auto;background:#fff;padding:44px 64px;box-shadow:0 0 40px #1830440c}header{border-bottom:3px solid #086ee0;padding-bottom:28px;margin-bottom:26px}h1{font-size:clamp(30px,4vw,44px);line-height:1.15;letter-spacing:-.03em;max-width:760px}h2{font-size:23px;line-height:1.3;margin:46px 0 22px;padding-top:20px;border-top:1px solid #d5dfe9;scroll-margin-top:20px}h3{font-size:19px;line-height:1.4;margin:0 0 14px}.eyebrow{font-size:13px;letter-spacing:.1em;font-weight:700;color:#48617b}.status{display:inline-block;background:#fff2df;color:#733e00;padding:5px 12px;border-radius:6px;font-weight:700}nav{display:grid;grid-template-columns:1fr 1fr;gap:8px 22px;padding:22px;background:#f2f6fb;font-size:13px}a{color:#075cae;overflow-wrap:anywhere}nav a{text-decoration:none}p{max-width:80ch;margin:18px 0}.lines{white-space:pre-line}.block{margin:24px 0;max-width:80ch}pre{white-space:pre;overflow:auto;font-size:13px;line-height:1.6;padding:20px;background:#f2f6fb;border-radius:6px}code{font-size:.9em}.recommendation{padding:22px 24px;background:#f8fafc;border-left:4px solid #1879d9;margin:24px 0}.recommendation p{margin-bottom:0;font-size:15px}.appendix{white-space:pre-wrap;font-family:inherit;font-size:14px}.links{padding:16px;background:#eef5fb;font-size:14px}footer{border-top:2px solid #cddbea;padding-top:20px;margin-top:40px;font-size:13px;color:#48617b}@media(max-width:650px){main{padding:24px 20px}nav{grid-template-columns:1fr}pre{font-size:11px}.recommendation{padding:16px}}@media print{body,main{background:white;box-shadow:none}main{max-width:none;padding:0}nav{display:none}h2,h3{break-after:avoid}pre{white-space:pre-wrap}.recommendation{break-inside:avoid}}
</style><main>${parts[0]}<nav aria-label="Report contents">${nav}</nav>${parts.slice(1).join("\n")}<h2>Verification ledger</h2><p class="links"><a href="MORNING_REPORT.txt">Plain-text report</a> · <a href="TEST_RESULTS.txt">Test ledger</a> · <a href="IMPLEMENTATION_ACCEPTANCE.txt">Exact implementation acceptance criteria</a> · <a href="performance-summary.json">Measurements</a></p><pre class="appendix">${appendix}</pre><footer>Review and diagnostics only. Source changes, deployment, provider tests and activation require their respective approvals. Evidence files are local; no tracking or external resources are loaded by this report.</footer></main></html>`;
fs.writeFileSync(root + "/REPORT.html", html);
console.log("Rendered report:", root + "/REPORT.html");
