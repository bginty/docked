# Docked Go-Live Checklist

The current website is a static GitHub Pages front-end with a full generated preview page, PayPal button, and RDAP-based domain signal check.

## Required next access

- Google Sheet webhook URL for lead capture
- PayPal product/subscription confirmation for the live `$30/month` offer
- Email inbox or forwarding for `hello@docked.com.au`
- ABN/business details, refund terms, privacy policy, and terms of service
- Later: registrar API account if Docked should automatically buy domains

## Current customer flow

1. Customer completes the brief on `docked.com.au`.
2. Docked opens a full generated website preview on `preview.html`.
3. Customer asks for improvements in plain language from the preview control panel.
4. Customer approves the preview from the preview page.
5. Approval details are prepared for spreadsheet capture.
6. Customer pays through PayPal.
7. Docked buys the domain, publishes the site, and keeps it active while the subscription is paid.

## Domain checking

- The site no longer redirects to GoDaddy.
- It checks the public RDAP registry signal.
- `200` means the domain is already registered.
- `404` means the domain is not in the registry database and is likely available.
- Final purchase still needs registrar confirmation because reserved, premium, and eligibility-restricted names can differ.

## Spreadsheet connection

The site is ready for a Google Sheets webhook. Create a Google Sheet, add the Apps Script in `google-sheets-webhook.gs`, deploy it as a web app, then paste the web app URL into `SHEET_WEBHOOK_URL` in `script.js` and `preview.js`.

## Current front-end files

- `index.html`
- `styles.css`
- `intake.css`
- `script.js`
- `preview.html`
- `preview.css`
- `preview.js`
- `google-sheets-webhook.gs`
- `CNAME`
- `.nojekyll`
- `assets/docked-ai-studio-hero.svg`

## GitHub Pages target

- GitHub user: `bginty`
- Repository: `docked`
- Custom domain: `docked.com.au`
