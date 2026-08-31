# Docked static GitHub Pages rollback

Last updated: 31 August 2026 (AEST)

## Recovery point

- Current `$299` production commit: `6086b28690b28cc5df01d521982bfa4d4e6d02a8`
- Immediate prior `$649` production commit: `5be6e075d6d72bf6ebc8c96b131b7fa257465868`
- Historical finance snapshot: `b26add982e5f4c7cfab2b13f74a14500d7199530`
- Historical archive branch: `archive/docked-finance-site-2026-08`
- Historical archive tag: `docked-finance-site-before-pool-rebuild`
- DNS and `CNAME` are not part of the rollback because this release keeps GitHub Pages and `docked.com.au` unchanged.

The finance snapshot, branch and tag are retained only as historical evidence. They are not an approved website rollback target and must never be restored, merged or pushed to `main`. Every production rollback must keep the public domain on a Cruise D2 storefront or on a newly prepared neutral maintenance/ordering-unavailable page with no mortgage, lending or finance content.

## Non-destructive price-release rollback

The PayPal Hosted Button amount is managed remotely. Do not restore the prior `$649` website files while PayPal still displays `$299.00 AUD`; that would recreate a customer-facing price mismatch. If the owner deliberately restores PayPal to `$649` and the rendered widget is independently verified at `$649.00 AUD`, restore only the four prior website price files in a new commit. If PayPal cannot be verified or website and checkout amounts differ, use commerce containment instead.

Do not force-push and do not delete the failed Docked commit. From a clean, up-to-date checkout:

```powershell
git fetch origin --prune
git switch -c codex/docked-price-rollback origin/main
git restore --source=5be6e075d6d72bf6ebc8c96b131b7fa257465868 --staged --worktree -- assets/js/product-config.js index.html shipping-returns.html terms.html
git commit -m "revert: restore prior verified Docked price"
git push -u origin codex/docked-price-rollback
git push origin codex/docked-price-rollback:main
```

After Pages deploys, verify that every website amount matches the remotely configured PayPal amount, both policy pages agree, and no stale competing price remains.

## Non-destructive commerce withdrawal

If the entire commerce experience must be withdrawn, create the containment revision from the current `origin/main`, not from either finance archive reference:

```powershell
git fetch origin --prune
git switch -c codex/docked-commerce-containment origin/main
```

In that new branch, keep the current Cruise D2 identity and legal pages, remove the PayPal SDK/embed and hosted-button identifier, set `checkoutEnabled` to `false`, and replace purchase controls with an accurate ordering-unavailable message. If a neutral maintenance page is preferred, create and review it in this branch; there is no pre-approved maintenance snapshot to restore. Run the complete validation and rendered smoke tests before committing and pushing the containment branch for review.

Only after the exact containment commit has been reviewed should it be fast-forwarded to `main`. Stop if `origin/main` changed unexpectedly, inspect the intervening commits and prepare a reviewed rollback commit instead. Never use `--force` or `--force-with-lease`, and never use `b26add982e5f4c7cfab2b13f74a14500d7199530`, `archive/docked-finance-site-2026-08` or `docked-finance-site-before-pool-rebuild` as a production restore source.

## Verification after rollback

1. Wait for GitHub Pages to finish deploying the revert commit.
2. Confirm `https://docked.com.au` returns HTTPS successfully.
3. Confirm the intended target is served: a website whose displayed amount exactly matches the verified PayPal Hosted Button, or the reviewed Cruise D2 ordering-unavailable/neutral maintenance experience after commerce withdrawal.
4. Confirm `www.docked.com.au` redirects consistently.
5. Confirm `CNAME` remains `docked.com.au`.
6. Do not alter MX, SPF, DKIM, DMARC, nameservers or other email/domain records.
7. Record the incident, rollback commit, operator and verification time.

## Commerce containment

If the PayPal button is faulty, remove the SDK, hosted-button container and hosted-button ID in a new commit; set `checkoutEnabled` to `false`; restore the ordering-unavailable state; deploy normally; and preserve the payment evidence. Do not ask customers to pay by email and do not collect card details on the site.
