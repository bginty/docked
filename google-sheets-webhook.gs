const SPREADSHEET_ID = "1BU1jclFfLkmNOMjdcMLFC6BcAtxhh7iP_bHMWxCG_qQ";
const SHEET_NAME = "Docked Leads";

function doPost(e) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
  const payload = JSON.parse((e.postData && e.postData.contents) || "{}");
  const headers = [
    "submitted_at",
    "stage",
    "business",
    "email",
    "phone",
    "projectType",
    "industry",
    "primary_goal",
    "target_customer",
    "style_direction",
    "features",
    "uploaded_image_count",
    "preview_turnaround",
    "preferred_domain",
    "domain_status",
    "domain_lookup_source",
    "approved_business",
    "approved_email",
    "approved_domain",
    "preview_link",
    "subscription_price",
    "domain_buyout_price",
    "payment_status",
    "payment_provider",
    "details",
    "preview_requirements",
    "visual_references",
    "approval_notes",
    "revision_request",
    "preview_snapshot",
    "approved_preview_snapshot",
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
    .createTextOutput(JSON.stringify({ ok: true, service: "Docked lead capture" }))
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
