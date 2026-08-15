# Docked static GitHub Pages rollback

Last updated: 15 August 2026 (AEST)

## Recovery point

- Current product-led production commit: `5aceddc9726d7d2617c8e2e09c1b4f290f87e633`
- Immediate prior static storefront commit: `a4d9075e13a90a03a8587b5641626f0d42a36160`
- Prior GitHub Pages commit: `b26add982e5f4c7cfab2b13f74a14500d7199530`
- Archive branch: `archive/docked-finance-site-2026-08`
- Archive tag: `docked-finance-site-before-pool-rebuild`
- DNS and `CNAME` are not part of the rollback because this release keeps GitHub Pages and `docked.com.au` unchanged.

## Non-destructive presentation rollback

If only the product-media/conversion revision fails, restore the exact immediate prior static storefront tree in a new commit. This keeps the initial static PayPal storefront live while removing the current presentation revision.

Do not force-push and do not delete the failed Docked commit. From a clean, up-to-date checkout:

```powershell
git fetch origin --prune
git switch -c codex/docked-product-media-rollback origin/main
git restore --source=a4d9075e13a90a03a8587b5641626f0d42a36160 --staged --worktree -- .
git commit -m "revert: restore prior Docked static storefront"
git push -u origin codex/docked-product-media-rollback
git push origin codex/docked-product-media-rollback:main
```

After Pages deploys, verify that the A$649 PayPal storefront still renders and the supplier-image/conversion revision is absent.

## Non-destructive full commerce withdrawal

If the entire static commerce storefront must be withdrawn, restore the legacy finance-site tree in a new commit using the preserved recovery tag:

```powershell
git fetch origin --prune
git switch -c codex/docked-static-paypal-rollback origin/main
git restore --source=docked-finance-site-before-pool-rebuild --staged --worktree -- .
git commit -m "revert: restore Docked finance site"
git push -u origin codex/docked-static-paypal-rollback
git push origin codex/docked-static-paypal-rollback:main
```

Each procedure creates a new restoration commit without deleting the failed static-site history. The final push is intended to be a normal fast-forward production update. Stop if `origin/main` changed unexpectedly, inspect the intervening commits and prepare a reviewed rollback commit instead. Never use `--force` or `--force-with-lease` for either procedure.

## Verification after rollback

1. Wait for GitHub Pages to finish deploying the revert commit.
2. Confirm `https://docked.com.au` returns HTTPS successfully.
3. Confirm the intended target is served: the prior A$649 static storefront after a presentation rollback, or the finance homepage after a full commerce withdrawal.
4. Confirm `www.docked.com.au` redirects consistently.
5. Confirm `CNAME` remains `docked.com.au`.
6. Do not alter MX, SPF, DKIM, DMARC, nameservers or other email/domain records.
7. Record the incident, rollback commit, operator and verification time.

## Commerce containment

If the PayPal button is faulty, remove the SDK, hosted-button container and hosted-button ID in a new commit; set `checkoutEnabled` to `false`; restore the ordering-unavailable state; deploy normally; and preserve the payment evidence. Do not ask customers to pay by email and do not collect card details on the site.
