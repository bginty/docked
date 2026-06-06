const SPREADSHEET_ID = "1BU1jclFfLkmNOMjdcMLFC6BcAtxhh7iP_bHMWxCG_qQ";
const SHEET_NAME = "Docked Loan Leads";

function doPost(e) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
  const payload = JSON.parse((e.postData && e.postData.contents) || "{}");
  const headers = [
    "submitted_at",
    "stage",
    "lead_source",
    "loan_purpose",
    "timeframe",
    "property_value",
    "loan_amount",
    "deposit_equity",
    "postcode",
    "employment_type",
    "household_income",
    "name",
    "phone",
    "email",
    "notes",
    "consent_broker_contact",
    "referral_fee_disclosure",
    "consent_recorded",
    "calculator_snapshot",
    "affordability_snapshot",
    "statement_file_names",
    "statement_months",
    "analysis_method",
    "monthly_income_estimate",
    "monthly_spending_estimate",
    "monthly_debt_repayments",
    "monthly_surplus_estimate",
    "affordable_repayment_guide",
    "borrowing_capacity_guide",
    "repayment_frequency",
    "interest_rate",
    "loan_term_years",
    "monthly_expenses",
    "other_debt_repayments",
    "dependants",
    "current_rate",
    "new_rate",
    "switching_costs",
    "upfront_costs",
    "target_lvr",
    "extra_monthly_repayment",
  ];

  const activeHeaders = ensureHeaders(sheet, headers);
  sheet.appendRow(activeHeaders.map(function (header) {
    return formatValue(payload[header]);
  }));

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: "Docked loan lead capture" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureHeaders(sheet, requiredHeaders) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(requiredHeaders);
    return requiredHeaders;
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].filter(String);
  const missingHeaders = requiredHeaders.filter(function (header) {
    return currentHeaders.indexOf(header) === -1;
  });

  if (missingHeaders.length) {
    sheet.getRange(1, currentHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
  }

  return currentHeaders.concat(missingHeaders);
}

function formatValue(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return value || "";
}
