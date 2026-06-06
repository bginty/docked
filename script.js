const DOCKED_APP_SCRIPT_SRC = "https://cdn.jsdelivr.net/gh/bginty/docked@2b3601349954ea83e802344fd58ac4f0eef95af5/script.js";
const DOCKED_SHEET_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyQk75B3nAk8J3efa-Pl6VZCkJoqFLV2GcSFcd9DnpH5iGsLrf0uOkyNV47g37x2_UH/exec";

(function bootDockedApp() {
  const appScript = document.createElement("script");
  appScript.src = DOCKED_APP_SCRIPT_SRC;
  appScript.onload = () => {
    connectSheetLeadCapture();
    enhanceStatementUpload();
  };
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
  }, { capture: true });
}

function enhanceStatementUpload() {
  const statementForm = document.querySelector("#statementForm");
  const statementFiles = document.querySelector("#statementFiles");
  const dropZone = document.querySelector(".file-drop");
  const checkButton = statementForm?.querySelector('button[type="submit"]');
  if (!statementForm || !statementFiles || !dropZone) return;

  injectStatementUploadStyles();

  dropZone.id = "statementDropZone";
  dropZone.classList.add("enhanced-file-drop");
  statementFiles.setAttribute("accept", ".csv,.txt,.ofx,.qif,.pdf,.xls,.xlsx,.doc,.docx");
  if (checkButton) checkButton.id = "checkAffordabilityButton";

  const existingHint = dropZone.querySelector("span");
  if (existingHint) {
    existingHint.classList.add("file-drop-hint");
    existingHint.textContent = "Tap to choose files or drag them here. CSV, TXT, OFX, and QIF can be estimated. PDFs and documents are recorded for the enquiry.";
  }

  if (!dropZone.querySelector(".file-drop-action")) {
    const action = document.createElement("span");
    action.className = "file-drop-action";
    action.textContent = "Choose files";
    dropZone.appendChild(action);
  }

  let fileList = document.querySelector("#statementFileList");
  if (!fileList) {
    fileList = document.createElement("div");
    fileList.className = "file-list";
    fileList.id = "statementFileList";
    fileList.setAttribute("aria-live", "polite");
    dropZone.insertAdjacentElement("afterend", fileList);
  }

  const renderSelectedFiles = () => {
    const files = Array.from(statementFiles.files || []).slice(0, 6);
    dropZone.classList.toggle("has-files", files.length > 0);

    if (!files.length) {
      fileList.innerHTML = '<strong>No files selected yet</strong><span>After choosing files, press Check my affordability below.</span>';
      if (checkButton) checkButton.textContent = "Check my affordability";
      return;
    }

    const instantCount = files.filter((file) => /\.(csv|txt|ofx|qif)$/i.test(file.name)).length;
    const notedCount = files.length - instantCount;
    const summary = instantCount
      ? `${instantCount} file${instantCount === 1 ? "" : "s"} ready for instant estimate${notedCount ? `, ${notedCount} noted for enquiry` : ""}.`
      : "Files selected and noted. For an instant estimate, upload CSV, TXT, OFX, or QIF, or enter figures manually.";

    fileList.innerHTML = `
      <strong>${files.length} file${files.length === 1 ? "" : "s"} selected</strong>
      <span>${escapeHtml(summary)}</span>
      <ul>${files.map((file) => `<li>${escapeHtml(file.name)} (${formatFileSize(file.size)})</li>`).join("")}</ul>
    `;
    if (checkButton) checkButton.textContent = instantCount ? "Analyse selected files" : "Check manual figures";
  };

  statementFiles.addEventListener("change", renderSelectedFiles);

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("is-dragging");
  });

  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");

    const droppedFiles = Array.from(event.dataTransfer?.files || []);
    if (!droppedFiles.length || typeof DataTransfer === "undefined") return;

    const transfer = new DataTransfer();
    droppedFiles.slice(0, 6).forEach((file) => transfer.items.add(file));
    statementFiles.files = transfer.files;
    renderSelectedFiles();
  });

  statementForm.addEventListener("submit", () => {
    if (!checkButton) return;
    const nextLabel = checkButton.textContent;
    checkButton.textContent = "Checking affordability...";
    window.setTimeout(() => {
      if (checkButton.textContent === "Checking affordability...") checkButton.textContent = nextLabel || "Check my affordability";
    }, 1400);
  }, { capture: true });

  renderSelectedFiles();
}

function injectStatementUploadStyles() {
  if (document.querySelector("#statementUploadEnhancementStyles")) return;
  const style = document.createElement("style");
  style.id = "statementUploadEnhancementStyles";
  style.textContent = `
    .enhanced-file-drop {
      gap: 10px;
      padding: 20px;
      background: #f8fbff;
      border: 1.5px dashed #b9cff0;
      border-radius: 14px;
      cursor: pointer;
      transition: border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
    }
    .enhanced-file-drop input {
      background: #ffffff;
    }
    .enhanced-file-drop.is-dragging,
    .enhanced-file-drop.has-files {
      background: #eef5ff;
      border-color: #126bff;
      box-shadow: 0 0 0 4px rgba(18, 107, 255, 0.1);
    }
    .file-drop-action {
      display: inline-flex;
      width: fit-content;
      min-height: 36px;
      align-items: center;
      justify-content: center;
      padding: 0 14px;
      background: #126bff;
      border-radius: 999px;
      color: #ffffff !important;
      font-size: 0.8rem !important;
      font-weight: 950 !important;
    }
    .file-list {
      display: grid;
      gap: 6px;
      padding: 14px;
      background: #ffffff;
      border: 1px solid #e1e9f3;
      border-radius: 12px;
      color: #41546b;
    }
    .file-list strong {
      color: #071427;
      font-size: 0.92rem;
    }
    .file-list span,
    .file-list li {
      color: #6d7d91;
      font-size: 0.85rem;
      font-weight: 700;
    }
    .file-list ul {
      display: grid;
      gap: 5px;
      margin: 0;
      padding-left: 18px;
    }
  `;
  document.head.appendChild(style);
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

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[char];
  });
}
