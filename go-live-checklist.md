# Docked Loans Go-Live Checklist

The current website is a static GitHub Pages front-end for Australian loan lead generation. It includes calculators, a daily borrower answer, SEO question content, a broker-match lead form, and referral-fee disclosure.

## Required next access

- Google Apps Script web app URL for lead capture into the supplied Google Sheet
- Privacy policy and collection notice wording for borrower personal information
- Confirmation of who will contact borrowers: licensed broker, lender, aggregator, or authorised credit representative
- Broker/referral agreements and agreed commission terms
- Email inbox or forwarding for `hello@docked.com.au`
- Later: CRM, automation, broker routing, affiliate tracking, and daily article publishing workflow

## Current borrower flow

1. Visitor uses Docked loan calculators for repayments, borrowing power, refinance savings, deposit/LVR, or extra repayments.
2. Visitor reads a daily borrower answer and FAQ content.
3. Visitor requests a broker match through the lead form.
4. Visitor confirms consent for their details to be shared and acknowledges Docked may receive a referral fee or affiliate commission.
5. Docked receives the lead in local browser storage until the Google Sheet webhook is connected.
6. After the webhook is connected, leads can populate the Google Sheet automatically.

## Spreadsheet connection

The lead capture script is already pointed at this Google Sheet:

`1BU1jclFfLkmNOMjdcMLFC6BcAtxhh7iP_bHMWxCG_qQ`

To turn on live spreadsheet submissions, open the sheet, go to Extensions -> Apps Script, paste `google-sheets-webhook.gs`, deploy it as a web app, then paste the web app URL into `SHEET_WEBHOOK_URL` in `script.js`.

Use these Apps Script deployment settings:

- Execute as: Me
- Who has access: Anyone

## Compliance reminders

- The calculators are estimates only and should not be promoted as credit approval or personalised credit advice.
- The site should not say Docked is providing credit assistance unless the relevant licensing or representative arrangements are in place.
- The lead form includes consent to share details and referral-fee disclosure, but final wording should be reviewed before scaling paid lead sales.
- Add a privacy policy before running ads or sending leads to third parties.
- Only transfer borrower details to brokers, lenders, aggregators, or representatives who are properly authorised for the activity they perform.

## Current front-end files

- `index.html`
- `styles.css`
- `script.js`
- `preview.html`
- `google-sheets-webhook.gs`
- `CNAME`
- `.nojekyll`

## GitHub Pages target

- GitHub user: `bginty`
- Repository: `docked`
- Custom domain: `docked.com.au`
