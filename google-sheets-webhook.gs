function doPost(e) {
  const sheetName = "Docked Leads";
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  const payload = JSON.parse(e.postData.contents || "{}");
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
    "preferred_domain",
    "domain_status",
    "approved_business",
    "approved_email",
    "approved_domain",
    "preview_link",
    "subscription_price",
    "domain_buyout_price",
    "details",
    "preview_requirements",
    "visual_references",
    "approval_notes",
    "revision_request",
    "preview_snapshot",
    "approved_preview_snapshot",
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  sheet.appendRow(headers.map(function (header) {
    return payload[header] || "";
  }));

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
