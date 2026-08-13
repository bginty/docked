# Docked baseline audit

Audit timestamp: 13 August 2026, 22:42 AEST (UTC+10)

## Scope and identity

- Audited workspace: `C:\Users\61412\Documents\ChatGPT\Docked.com.au`
- The workspace path is Docked-specific and contains no Oura CRM files.
- At the start of the audit the worktree contained only `.git/`.
- The local repository was valid but unborn: branch `master`, no commits, no remote, no files, and no tags.
- There was therefore no local legacy source to overwrite and no local checkpoint from which to restore it.

## Live-site discovery

The public site at <https://docked.com.au/> was inspected before any project file was changed. It identified its legacy source through pinned jsDelivr assets from `github.com/bginty/docked`. The public repository was verified with `git ls-remote` and cloned to a temporary read-only audit folder.

Verified legacy source:

- Repository: <https://github.com/bginty/docked>
- Default branch: `main`
- Production commit at audit: `b26add982e5f4c7cfab2b13f74a14500d7199530`
- Commit subject: `Bump blue theme assets`
- Commit timestamp: 8 June 2026, 09:38:35 AEST
- History length at audit: 101 commits
- Hosting architecture: static HTML, CSS and JavaScript on GitHub Pages
- Custom-domain file: `CNAME` containing `docked.com.au`
- No Vercel, Netlify, Shopify, package-manager or application-framework configuration was present.

## Legacy source recovery

The empty local repository was connected to the verified public origin and the legacy history was fetched without rewriting it.

- Required archive branch: `archive/docked-finance-site-2026-08`
- Required annotated tag: `docked-finance-site-before-pool-rebuild`
- Rebuild branch: `codex/docked-pool-commerce-rebuild`
- Starting commit for all three references: `b26add982e5f4c7cfab2b13f74a14500d7199530`
- Archive branch push: verified
- Archive tag push: verified
- `origin/main` was not changed.

The legacy public deployment remains available independently through `origin/main` and GitHub Pages.

## Legacy file inventory

The recovered site includes:

- `index.html`, `about.html`, `faq.html`, `privacy.html`, `terms.html`
- `preview.html` and associated preview assets
- `styles.css`, `intake.css`, `preview.css`
- `script.js`, `preview.js`, `google-sheets-webhook.gs`
- legacy Docked logo, icon and favicon files
- `robots.txt`, `sitemap.xml`, `.nojekyll`, and `CNAME`
- one SVG hero asset under `assets/`

See `docs/LEGACY_SITE_INVENTORY.md` for the public route and content audit.

## Secret and credential review

Two scans were performed without printing possible secret values:

1. The original empty worktree contained no candidate secret-bearing files or source content.
2. The recovered legacy checkout was scanned by filename and by common key/token/password/webhook patterns.

Result: no secret-like files or matching secret-value patterns were found in the recovered worktree. This does not replace a full historical secret scan before release.

Never commit Shopify Admin tokens, Shopify CLI authentication, payment or banking data, DNS credentials, customer data, service-account credentials, or private keys.

## Baseline constraints

- No Shopify store URL, store access, theme ID, or Shopify CLI session has been verified.
- No bank or payout details have been supplied.
- No supplier evidence, approved product specifications, compliance approvals, stock figures, landed costs, or licensed product photography have been supplied.
- The public GitHub Pages deployment must remain untouched until an unpublished Shopify preview passes its launch gates.
- DNS must not be changed until the preview, checkout, compliance, email, and owner-action gates are complete.

## Evidence commands used

Read-only evidence was collected with Git status/log/ref commands, filesystem inventory, pattern-only secret scans, DNS lookups, live DOM inspection, and the public repository's Git history. No real customer form, payment, email, or checkout submission was made.
