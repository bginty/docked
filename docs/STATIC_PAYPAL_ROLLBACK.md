# Docked static GitHub Pages rollback

Last updated: 15 August 2026 (AEST)

## Recovery point

- Prior GitHub Pages commit: `b26add982e5f4c7cfab2b13f74a14500d7199530`
- Archive branch: `archive/docked-finance-site-2026-08`
- Archive tag: `docked-finance-site-before-pool-rebuild`
- DNS and `CNAME` are not part of the rollback because this release keeps GitHub Pages and `docked.com.au` unchanged.

## Non-destructive rollback

Do not force-push and do not delete the failed Docked commit. From a clean, up-to-date checkout:

```powershell
git fetch origin --prune
git switch -c codex/docked-static-paypal-rollback origin/main
git restore --source=docked-finance-site-before-pool-rebuild --staged --worktree -- .
git commit -m "revert: restore Docked finance site"
git push -u origin codex/docked-static-paypal-rollback
git push origin codex/docked-static-paypal-rollback:main
```

This creates a new restoration commit without deleting the failed static-site history. The last command is intended to be a normal fast-forward production update. Stop if `origin/main` changed unexpectedly, inspect the intervening commits and prepare a reviewed rollback commit instead. Never use `--force` or `--force-with-lease` for this procedure.

## Verification after rollback

1. Wait for GitHub Pages to finish deploying the revert commit.
2. Confirm `https://docked.com.au` returns HTTPS successfully.
3. Confirm the expected prior finance homepage is served.
4. Confirm `www.docked.com.au` redirects consistently.
5. Confirm `CNAME` remains `docked.com.au`.
6. Do not alter MX, SPF, DKIM, DMARC, nameservers or other email/domain records.
7. Record the incident, rollback commit, operator and verification time.

## Commerce containment

If the PayPal button is faulty, remove the SDK, hosted-button container and hosted-button ID in a new commit; set `checkoutEnabled` to `false`; restore the ordering-unavailable state; deploy normally; and preserve the payment evidence. Do not ask customers to pay by email and do not collect card details on the site.
