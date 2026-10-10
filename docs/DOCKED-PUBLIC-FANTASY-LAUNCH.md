# Public fantasy landing page — deployed 10 October 2026

Owner authority: the explicit public fantasy website refresh supersedes preserving the old holding page. It does not authorize public gameplay, account activation, invitations, payments or marketplace trading.

## Production result

- Live canonical URL: https://docked.com.au/
- www: https://www.docked.com.au/ redirects to the HTTPS apex.
- Hosting: existing GitHub Pages for `bginty/docked`, `main`, repository root. No hosting migration or paid service.
- Final production commit: `732057330afcdeba6c021a2e15f78bf79cd80142` (cache-versioned assets); content release `b1389f1914d7d8b2e2c22a20c0815b59573c161e`.
- Successful Pages deployment run: https://github.com/bginty/docked/actions/runs/38035271456
- Previous production commit: `baf3c87611eee8f45ca08ad3649242739b1f1a34`.

The public page explains Collect / Build / Compete and the multi-sport direction. It explicitly identifies broader gameplay as coming soon and live scoring, trading, paid cards and real-money transactions as unavailable. It contains no registration or data-collection form, application API, database configuration or third-party script.

Approved supplied fantasy logo, responsive stadium artwork, favicon, PWA icons and Open Graph image replace the legacy assets. All nine public HTML documents were refreshed, including previous route URLs and the custom404. Legacy page URLs now explain retirement and link to the new homepage/support; they do not expose the previous content or imply approval of new policy versions. Approved account policy bytes were not changed. Metadata, social previews, manifest and sitemap use the fantasy direction. Returning browsers receive versioned CSS/manifest URLs.

## Existing owner Sign In

Destination: https://docked-production-5uwewz9wi-briant-s-projects.vercel.app/app/login

This is the already-authorized owner deployment `dpl_4EBn3fQmnKp3XWkNKGy4tb8j3FZu`, application commit `20c794945ba279d77034715fd8989fc5d779f809`. Authenticated connector readback confirmed READY and built-in Preview targetnull. The public button intentionally retains Vercel protection; visitors without access meet that protection rather than a public application. A short-lived authorized test verified the hydrated email/password form (200), the anonymous fantasy sign-in gate, data API denial403, and closed signup503. No passwords, MFA codes, invitations, emails or accounts were created/used by the agent in this release.

The first test harness expected different login text and a redirect instead of the deployed gated page. Those assertions were corrected after inspecting the exact deployed source; they were not application defects and were not counted as passes. Fresh corrected checks passed. Local API read with the cached Vercel CLI token returned403; the authenticated connector and supported CLI environment flow provided read/test access. No Vercel project or security configuration changed.

## Verification

- Public HTTPS200; www and both HTTP forms redirect to HTTPS apex.
- GitHub Pages HTTPS enforcement enabled only after validating existing TLS on apex/www. CNAME, source branch, DNS and email records unchanged.
- Live Chromium at320,390,768,1440px: no horizontal overflow, broken images or page errors; anchor navigation and sign-in links correct; automated WCAG2/2.1/2.2 A/AA checks found zero violations.
- All nine public HTML pages checked for retired messaging. CSS, manifest and sitemap checked too.
- Supplied social image fetched successfully and matches approved local bytes. Social image/title/description metadata checked. Third-party social caches cannot be forced to refresh by this release.
- Thirteen live HTML/CSS/manifest/sitemap/CNAME files match the committed payload after newline normalization.
- Physical Android/iPhone testing was not performed; mobile results are browser emulation.

Evidence: [live report](qa/public-fantasy-launch/live-report.json), [deployment](qa/public-fantasy-launch/deployment.json), [payload](qa/public-fantasy-launch/payload.json), [sign-in controls](qa/public-fantasy-launch/signin-check.json), [HTTPS](qa/public-fantasy-launch/https.json), [mobile screenshot](qa/public-fantasy-launch/live-390.png), [desktop screenshot](qa/public-fantasy-launch/live-1440.png).

## Isolation and rollback

Production was prepared in the clean existing `.pages-deploy` worktree on `codex/fantasy-public-landing`, based on the actual Pages production commit. Only the static public allowlist was committed and fast-forwarded to main. `vercel.json` continues to disable Git-triggered Vercel deployment on this static branch. No uncommitted application feature, migration or secret entered the release. No application, Supabase, Oura, original Preview, MFA, Microsoft permission or payment setting was modified.

Rollback can use reviewed revert commits for `73205733` and `b1389f19` on Pages main, restoring the prior public payload without force-pushing or touching application history. Keep HTTPS enforced. DNS rollback is unnecessary because DNS was not changed.
