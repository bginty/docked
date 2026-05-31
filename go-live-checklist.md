# Docked Go-Live Checklist

The current website is a static GitHub Pages front-end with a full customer intake form, PayPal button, and RDAP-based domain signal check.

## Required next access

- Google Apps Script web app URL for lead capture into the supplied Google Sheet
- PayPal product/subscription confirmation for the live `$30/month` offer
- Email inbox or forwarding for `hello@docked.com.au`
- ABN/business details, refund terms, privacy policy, and terms of service
- Later: registrar API account if Docked should automatically buy domains

## Current customer flow

1. Customer completes the full brief on `docked.com.au`.
2. Docked receives the request details and prepares a free website or logo preview within 24 hours.
3. Customer reviews the preview sent by Docked.
4. Changes are handled in a simple back-and-forth loop until the customer is happy with the direction.
5. Customer pays through PayPal or a direct debit arrangement after approval.
6. Docked buys the domain, publishes the site, and keeps it active while the subscription is paid.

## Domain checking

- The site no longer redirects to GoDaddy.
- It checks the public RDAP registry signal.
- `200` means the domain is already registered.
- `404` means the domain is not in the registry database and is likely available.
- Final purchase still needs registrar confirmation because reserved, premium, and eligibility-restricted names can differ.

## Spreadsheet connection

The lead capture script is already pointed at this Google Sheet:

`1BU1jclFfLkmNOMjdcMLFC6BcAtxhh7iP_bHMWxCG_qQ`

To turn on live spreadsheet submissions, open the sheet, go to Extensions -> Apps Script, paste `google-sheets-webhook.gs`, deploy it as a web app, then paste the web app URL into `SHEET_WEBHOOK_URL` in both `script.js` and `preview.js`.

Use these Apps Script deployment settings:

- Execute as: Me
- Who has access: Anyone

Uploaded images are requested for the manual preview process. The spreadsheet receives image file names and image counts, not the image data itself. Persistent image storage can be added later with Drive, Cloudinary, or S3.

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
