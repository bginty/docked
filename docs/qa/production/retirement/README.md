# Public storefront retirement — 4 October 2026

The old Docked storefront has been removed from public deployment at the owner's explicit request. [docked.com.au](https://docked.com.au/) now serves the approved-brand transition page: “Sports intelligence. Community. Transparency.” and “The new Docked experience is on its way.” **This is not the new application's production launch.** No date, sporting opportunity or performance result is invented.

## Deployment identity

| Item                                      | Observed value                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| Static source                             | `baf3c87611eee8f45ca08ad3649242739b1f1a34`, repository `bginty/docked`, branch `main` |
| Pages execution                           | [37156304851](https://github.com/bginty/docked/actions/runs/37156304851), successful  |
| Retained local acceptance                 | 3 October 2026, 21:47:09 UTC / 4 October, 08:47:09 Sydney                             |
| Retained live acceptance                  | 3 October 2026, 21:50:44 UTC / 4 October, 08:50:44 Sydney                             |
| Independent redirect/Preview verification | 3 October 2026, 21:54:16 UTC / 4 October, 08:54:16 Sydney                             |

The source keeps `CNAME` and `.nojekyll`, supplied wordmark/D artwork, self-hosted Sora and its licence. Existing HTML destinations show a neutral transition page, including a branded 404. Old checkout/payment scripts, product configuration and product imagery are absent from the deployed output. The inherited existing-order support `mailto` remains; there are no forms, scripts, tracking or automatic Preview redirects. `vercel.json` disables Git deployments for this static source. Git history and the new application branch are preserved.

## Acceptance

[Local receipt](local/acceptance.json) and [live receipt](live/acceptance.json) each cover 320, 412 and 1,440-pixel widths. Every width returned HTTP 200, zero horizontal overflow, zero broken images, zero Axe violations and zero console errors. The live 412-pixel image was visually reviewed by the release operator.

| Retired destination                             | Live result                  |
| ----------------------------------------------- | ---------------------------- |
| `/shipping-returns.html`                        | 200, neutral transition page |
| `/warranty.html`                                | 200, neutral transition page |
| `/thank-you.html`                               | 200, neutral transition page |
| `/assets/js/product-config.js`                  | 404                          |
| `/assets/images/product/cruise-d2-features.jpg` | 404                          |

Fresh screenshots: [live 320](live/home-320.png), [live 412](live/home-412.png), [live 1440](live/home-1440.png); [local 320](local/home-320.png), [local 412](local/home-412.png), [local 1440](local/home-1440.png).

The [independent read-only receipt](https-preview-check.json) confirms HTTPS apex 200 and HTTPS `www` 301 to `https://docked.com.au/`. Certificate verification was enabled through the normal HTTPS client. No DNS or email records were changed for this Pages replacement.

## Preview remained separate

Docked Preview project `prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR` still serves deployment `dpl_5Up2hMH7mksYzkC5EfnDnknm7EBj`, accepted application source `38f90a13b5cd8834460b1ecdd6e2ff61ec949dd0`, at its existing Preview alias. The complete recent deployment listing contains no static retirement source and no deployment after the retirement commit. The API reports database connectivity with feed, strategy and publication false; both provider statuses are NOT_CONFIGURED. This check performed no cloud mutation or provider call and emitted no credentials.

## Remaining release boundary

Dedicated application production resources, owner hosting/cost decisions, verified operator facts, approved policies and subsequent production acceptance remain outstanding. Public signup and recovery additionally require verified transactional email readiness. Preview accounts, demo records and the installed Preview APK remain in Preview. The neutral transition page is the permitted website fallback; never restore the retired storefront. See [PRODUCTION_RELEASE.md](../../../PRODUCTION_RELEASE.md) for exact steps and inputs. New-application test totals are maintained separately and are not implied by these static-page checks.
