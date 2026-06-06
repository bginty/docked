const DOCKED_APP_SCRIPT_SRC = "https://cdn.jsdelivr.net/gh/bginty/docked@2b3601349954ea83e802344fd58ac4f0eef95af5/script.js";
const DOCKED_SHEET_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyQk75B3nAk8J3efa-Pl6VZCkJoqFLV2GcSFcd9DnpH5iGsLrf0uOkyNV47g37x2_UH/exec";

(function bootDockedApp() {
  const appScript = document.createElement("script");
  appScript.src = DOCKED_APP_SCRIPT_SRC;
  appScript.onload = connectSheetLeadCapture;
  appScript.onerror = () => {
    const formStatus = document.querySelector("#formStatus");
    if (formStatus) formStatus.textContent = "The calculator tools are taking a moment to load. Please refresh and try again.";
  };
  document.head.appendChild(appScript);
})();

function connectSheetLeadCapture() {
  const leadForm = document.querySelector("#leadForm");
  const formStatus = document.querySelector("#formStatus");
  if (!leadForm || leadForm.dataset.sheetCaptureConnected === "true") return;

  leadForm.dataset.sheetCaptureConnected = "true";
  leadForm.addEventListener("submit", async () => {
    if (!leadForm.checkValidity()) return;

    const formData = new FormData(leadForm);
    const payload = buildSheetPayload(formData);

    try {
      await fetch(DOCKED_SHEET_WEBHOOK_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      if (formStatus) formStatus.textContent = "Thanks, your loan help request has been received.";
    } catch {
      if (formStatus) formStatus.textContent = "Thanks, your loan help request is saved on this device, but the sheet connection did not respond.";
    }
  });
}

function buildSheetPayload(formData) {
  const payload = {
    submitted_at: new Date().toISOString(),
    stage: "loan_help_requested",
    lead_source: "docked.com.au",
    ...formDataToObject(formData),
    consent_recorded: "yes",
  };

  const affordability = parseJson(payload.affordability_snapshot);
  if (affordability) {
    payload.statement_months = affordability.months || "";
    payload.analysis_method = affordability.analysis_method || "";
    payload.monthly_income_estimate = affordability.monthly_income_estimate || "";
    payload.monthly_spending_estimate = affordability.monthly_spending_estimate || "";
    payload.monthly_debt_repayments = affordability.monthly_debt_repayments || "";
    payload.monthly_surplus_estimate = affordability.monthly_surplus_estimate || "";
    payload.affordable_repayment_guide = affordability.affordable_repayment_guide || "";
    payload.borrowing_capacity_guide = affordability.borrowing_capacity_guide || "";
  }

  const calculator = parseJson(payload.calculator_snapshot);
  if (calculator?.values) {
    Object.entries(calculator.values).forEach(([key, value]) => {
      if (payload[key] === undefined || payload[key] === "") payload[key] = value;
    });
  }

  return payload;
}

function formDataToObject(formData) {
  const output = {};
  for (const [key, value] of formData.entries()) {
    if (!value) continue;
    output[key] = output[key] ? `${output[key]}, ${value}` : value;
  }
  return output;
}

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}
