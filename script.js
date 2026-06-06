const DOCKED_APP_SCRIPT_SRC = "https://cdn.jsdelivr.net/gh/bginty/docked@2b3601349954ea83e802344fd58ac4f0eef95af5/script.js";
const DOCKED_SHEET_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyQk75B3nAk8J3efa-Pl6VZCkJoqFLV2GcSFcd9DnpH5iGsLrf0uOkyNV47g37x2_UH/exec";
const DOCKED_PDFJS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";

let dockedPdfJsPromise = null;

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
  leadForm.addEventListener(
    "submit",
    async () => {
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
    },
    { capture: true },
  );
}

function enhanceStatementUpload() {
  const statementForm = document.querySelector("#statementForm");
  const statementFiles = document.querySelector("#statementFiles");
  const dropZone = document.querySelector(".file-drop");
  const affordabilityResult = document.querySelector("#affordabilityResult");
  const useAffordabilityButton = document.querySelector("#useAffordabilityButton");
  const checkButton = statementForm?.querySelector('button[type="submit"]');
  if (!statementForm || !statementFiles || !dropZone || !affordabilityResult) return;

  injectStatementUploadStyles();

  dropZone.id = "statementDropZone";
  dropZone.classList.add("enhanced-file-drop");
  statementFiles.setAttribute("accept", ".csv,.txt,.ofx,.qif,.pdf,.xls,.xlsx,.doc,.docx");
  if (checkButton) checkButton.id = "checkAffordabilityButton";

  const existingHint = dropZone.querySelector("span");
  if (existingHint) {
    existingHint.classList.add("file-drop-hint");
    existingHint.textContent = "Tap to choose files or drag them here. CSV, TXT, OFX, QIF and text-based PDFs can be estimated. Documents are recorded for the enquiry.";
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
    window.dockedEnhancedAffordability = null;
    if (useAffordabilityButton) useAffordabilityButton.disabled = true;

    if (!files.length) {
      fileList.innerHTML = '<strong>No files selected yet</strong><span>After choosing files, press Check my affordability below.</span>';
      if (checkButton) checkButton.textContent = "Check my affordability";
      return;
    }

    const estimateCount = files.filter((file) => /\.(csv|txt|ofx|qif|pdf)$/i.test(file.name)).length;
    const manualCount = files.length - estimateCount;
    const summary = estimateCount
      ? `${estimateCount} file${estimateCount === 1 ? "" : "s"} ready to try for an instant estimate${manualCount ? `, ${manualCount} recorded for enquiry` : ""}.`
      : "Files selected and recorded. For an instant estimate, upload CSV, TXT, OFX, QIF, a text-based PDF, or enter figures manually.";

    fileList.innerHTML = `
      <strong>${files.length} file${files.length === 1 ? "" : "s"} selected</strong>
      <span>${escapeHtml(summary)}</span>
      <ul>${files.map((file) => `<li>${escapeHtml(file.name)} (${formatFileSize(file.size)})</li>`).join("")}</ul>
    `;
    if (checkButton) checkButton.textContent = estimateCount ? "Analyse selected files" : "Check manual figures";
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

  statementForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (checkButton) {
        checkButton.disabled = true;
        checkButton.textContent = "Checking affordability...";
      }

      const snapshot = await analyseEnhancedAffordability(statementForm, statementFiles);
      window.dockedEnhancedAffordability = snapshot?.ok ? snapshot : null;
      renderEnhancedAffordability(snapshot, affordabilityResult);
      syncAffordabilityHiddenFields(snapshot);
      if (useAffordabilityButton) useAffordabilityButton.disabled = !snapshot?.ok;

      if (checkButton) {
        checkButton.disabled = false;
        checkButton.textContent = snapshot?.ok ? "Re-check affordability" : "Check manual figures";
      }
    },
    { capture: true },
  );

  useAffordabilityButton?.addEventListener(
    "click",
    (event) => {
      if (!window.dockedEnhancedAffordability?.ok) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      applyEnhancedAffordabilityToLeadForm(window.dockedEnhancedAffordability);
      document.querySelector("#lead")?.scrollIntoView({ behavior: "smooth", block: "start" });
      const formStatus = document.querySelector("#formStatus");
      if (formStatus) formStatus.textContent = "Affordability result added to your help request.";
    },
    { capture: true },
  );

  renderSelectedFiles();
}

async function analyseEnhancedAffordability(form, fileInput) {
  const months = Math.max(1, readFormNumber(form, "statement_months") || 3);
  const dependants = readFormNumber(form, "statement_dependants");
  const debts = readFormNumber(form, "statement_debts");
  const bufferPercent = readFormNumber(form, "statement_buffer") || 25;
  const manualIncome = readFormNumber(form, "manual_income");
  const manualSpending = readFormNumber(form, "manual_spending");
  const files = Array.from(fileInput?.files || []).slice(0, 6);
  const parsed = await parseEnhancedStatementFiles(files, months);

  const monthlyIncome = manualIncome || parsed.monthlyIncome;
  const monthlySpending = manualSpending || parsed.monthlySpending;

  if (!monthlyIncome || !monthlySpending) {
    const manualDetails = form.querySelector(".manual-details");
    if (manualDetails && files.some((file) => /\.pdf$/i.test(file.name))) manualDetails.open = true;
    return {
      ok: false,
      message:
        "I found the file, but I could not confidently read both income and spending from it. If it is a PDF, it may be scanned, encrypted, or laid out in a way the browser cannot read. Enter monthly after-tax income and monthly living spending manually, then check again.",
      fileNames: files.map((file) => file.name),
      skippedFiles: parsed.skippedFiles,
    };
  }

  const dependantBuffer = dependants * 350;
  const monthlySurplus = monthlyIncome - monthlySpending - debts - dependantBuffer;
  const affordableRepayment = Math.max(0, monthlySurplus * (1 - bufferPercent / 100));
  const assessmentRate = 8.5;
  const borrowingGuide = principalFromRepayment(affordableRepayment, assessmentRate, 30, 12);
  const status =
    affordableRepayment >= 3500 ? "Strong starting point" : affordableRepayment >= 1500 ? "Possible, worth checking" : "Tight, needs review";

  return {
    ok: true,
    status,
    months,
    fileNames: files.map((file) => file.name),
    skippedFiles: parsed.skippedFiles,
    transaction_count: parsed.transactionCount,
    analysis_method: manualIncome || manualSpending ? "Manual figures with statement upload note" : parsed.analysisMethod,
    monthly_income_estimate: roundCurrency(monthlyIncome),
    monthly_spending_estimate: roundCurrency(monthlySpending),
    monthly_debt_repayments: roundCurrency(debts),
    dependant_buffer: roundCurrency(dependantBuffer),
    monthly_surplus_estimate: roundCurrency(monthlySurplus),
    repayment_buffer_percent: bufferPercent,
    affordable_repayment_guide: roundCurrency(affordableRepayment),
    borrowing_capacity_guide: roundCurrency(borrowingGuide),
    assessment_rate: assessmentRate,
    calculated_at: new Date().toISOString(),
  };
}

async function parseEnhancedStatementFiles(files, months) {
  const totals = {
    income: 0,
    spending: 0,
    transactionCount: 0,
    skippedFiles: [],
    analysisMethods: [],
  };

  for (const file of files) {
    try {
      let parsed = null;

      if (/\.pdf$/i.test(file.name)) {
        parsed = await parsePdfStatement(file);
        if (parsed.transactionCount) totals.analysisMethods.push("Browser PDF statement text estimate");
      } else if (/\.(csv|txt|ofx|qif)$/i.test(file.name)) {
        parsed = parseStatementText(await readFileAsText(file));
        if (parsed.transactionCount) totals.analysisMethods.push("Browser statement export estimate");
      } else {
        totals.skippedFiles.push(`${file.name}: file recorded, not parsed in browser`);
        continue;
      }

      totals.income += parsed.income;
      totals.spending += parsed.spending;
      totals.transactionCount += parsed.transactionCount;
      if (!parsed.transactionCount) totals.skippedFiles.push(`${file.name}: no clear debit/credit amounts found`);
    } catch (error) {
      totals.skippedFiles.push(`${file.name}: could not read file`);
    }
  }

  return {
    monthlyIncome: totals.income / months,
    monthlySpending: totals.spending / months,
    transactionCount: totals.transactionCount,
    skippedFiles: totals.skippedFiles,
    analysisMethod: totals.analysisMethods[0] || "Browser statement estimate",
  };
}

async function parsePdfStatement(file) {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), disableWorker: true }).promise;
  let income = 0;
  let spending = 0;
  let transactionCount = 0;
  const allLines = [];
  let lastColumns = null;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = groupPdfTextItems(content.items);
    allLines.push(...lines.map((line) => line.text));

    const columns = findPdfColumns(lines) || lastColumns;
    if (columns) lastColumns = columns;

    const parsed = columns ? parsePdfLinesWithColumns(lines, columns) : { income: 0, spending: 0, transactionCount: 0 };
    income += parsed.income;
    spending += parsed.spending;
    transactionCount += parsed.transactionCount;
  }

  if (!transactionCount) {
    const fallback = parseStatementText(allLines.join("\n"));
    income += fallback.income;
    spending += fallback.spending;
    transactionCount += fallback.transactionCount;
  }

  return { income, spending, transactionCount };
}

async function loadPdfJs() {
  if (!dockedPdfJsPromise) dockedPdfJsPromise = import(DOCKED_PDFJS_URL);
  return dockedPdfJsPromise;
}

function groupPdfTextItems(items) {
  const rows = [];
  for (const item of items || []) {
    const text = String(item.str || "").trim();
    if (!text) continue;
    const x = Number(item.transform?.[4] || 0);
    const y = Number(item.transform?.[5] || 0);
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 3);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ text, x, y });
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      const sortedItems = row.items.sort((a, b) => a.x - b.x);
      return {
        y: row.y,
        items: sortedItems,
        text: sortedItems.map((item) => item.text).join("\t"),
      };
    });
}

function findPdfColumns(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const text = line.text.toLowerCase();
    if (!/(debit|withdrawal|money out|credit|deposit|money in)/.test(text)) continue;

    const debitItem = findHeaderItem(line.items, ["debit", "withdrawal", "out"]);
    const creditItem = findHeaderItem(line.items, ["credit", "deposit", "in"]);
    const balanceItem = findHeaderItem(line.items, ["balance"]);

    if (debitItem || creditItem) {
      return {
        headerIndex: index,
        debitX: debitItem?.x ?? null,
        creditX: creditItem?.x ?? null,
        balanceX: balanceItem?.x ?? null,
      };
    }
  }
  return null;
}

function findHeaderItem(items, words) {
  return items.find((item) => words.some((word) => item.text.toLowerCase().includes(word))) || null;
}

function parsePdfLinesWithColumns(lines, columns) {
  let income = 0;
  let spending = 0;
  let transactionCount = 0;
  const start = Math.max(0, (columns.headerIndex || 0) + 1);

  for (const line of lines.slice(start)) {
    const moneyItems = line.items
      .map((item) => ({ ...item, amount: parseMoneyToken(item.text) }))
      .filter((item) => item.amount);
    if (!moneyItems.length) continue;

    let counted = false;
    for (const item of moneyItems) {
      if (columns.balanceX !== null && Math.abs(item.x - columns.balanceX) < 44) continue;
      if (columns.debitX !== null && Math.abs(item.x - columns.debitX) < 58) {
        spending += Math.abs(item.amount);
        counted = true;
        continue;
      }
      if (columns.creditX !== null && Math.abs(item.x - columns.creditX) < 58) {
        income += Math.abs(item.amount);
        counted = true;
      }
    }
    if (counted) transactionCount += 1;
  }

  return { income, spending, transactionCount };
}

function parseStatementText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return { income: 0, spending: 0, transactionCount: 0 };

  const headerInfo = findDelimitedHeader(lines);
  if (headerInfo) {
    return parseStatementRows(lines.slice(headerInfo.index + 1), headerInfo.indexes);
  }

  return parseSignedAmountRows(lines);
}

function findDelimitedHeader(lines) {
  for (let index = 0; index < Math.min(lines.length, 40); index += 1) {
    const header = parseDelimitedLine(lines[index]).map((cell) => cell.toLowerCase());
    const debitIndex = findHeaderIndex(header, ["debit", "withdrawal", "money out", "payment", "spent", "debit amount"]);
    const creditIndex = findHeaderIndex(header, ["credit", "deposit", "money in", "received", "credit amount"]);
    const amountIndex = findHeaderIndex(header, ["amount", "transaction amount", "value"]);
    if (debitIndex >= 0 || creditIndex >= 0 || amountIndex >= 0) return { index, indexes: { debitIndex, creditIndex, amountIndex } };
  }
  return null;
}

function parseStatementRows(lines, indexes) {
  let income = 0;
  let spending = 0;
  let transactionCount = 0;

  for (const line of lines) {
    const cells = parseDelimitedLine(line);
    const debit = parseMoney(cells[indexes.debitIndex]);
    const credit = parseMoney(cells[indexes.creditIndex]);
    const amount = parseMoney(cells[indexes.amountIndex]);
    let counted = false;

    if (debit) {
      spending += Math.abs(debit);
      counted = true;
    }
    if (credit) {
      income += Math.abs(credit);
      counted = true;
    }
    if (!counted && amount) {
      if (amount > 0) income += amount;
      else spending += Math.abs(amount);
      counted = true;
    }
    if (counted) transactionCount += 1;
  }

  return { income, spending, transactionCount };
}

function parseSignedAmountRows(lines) {
  const amounts = [];
  for (const line of lines) {
    const matches = line.match(/\(?-?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?|\(?-?\$?\d+(?:\.\d{2})\)?/g) || [];
    if (!matches.length) continue;
    const amount = parseMoney(matches[matches.length - 1]);
    if (amount) amounts.push(amount);
  }

  const hasPositive = amounts.some((amount) => amount > 0);
  const hasNegative = amounts.some((amount) => amount < 0);
  if (!hasPositive || !hasNegative) return { income: 0, spending: 0, transactionCount: 0 };

  return amounts.reduce(
    (total, amount) => {
      if (amount > 0) total.income += amount;
      else total.spending += Math.abs(amount);
      total.transactionCount += 1;
      return total;
    },
    { income: 0, spending: 0, transactionCount: 0 },
  );
}

function parseDelimitedLine(line) {
  const cells = [];
  let value = "";
  let quoted = false;
  for (const char of String(line || "")) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && (char === "," || char === "\t")) {
      cells.push(value.trim());
      value = "";
      continue;
    }
    value += char;
  }
  cells.push(value.trim());
  return cells;
}

function findHeaderIndex(header, words) {
  return header.findIndex((cell) => words.some((word) => cell.includes(word)));
}

function renderEnhancedAffordability(snapshot, target) {
  if (!target) return;
  if (!snapshot?.ok) {
    const skipped = snapshot?.skippedFiles?.length ? `<p>${escapeHtml(snapshot.skippedFiles.join(" "))}</p>` : "";
    target.innerHTML = `
      <p class="eyebrow">Result</p>
      <h3>More information needed</h3>
      <p>${escapeHtml(snapshot?.message || "Upload statement exports or enter figures manually to start.")}</p>
      ${skipped}
    `;
    return;
  }

  const skipped = snapshot.skippedFiles?.length ? `<p>${escapeHtml(snapshot.skippedFiles.join(" "))}</p>` : "";
  target.innerHTML = `
    <p class="eyebrow">${escapeHtml(snapshot.status)}</p>
    <h3>${formatCurrency(snapshot.borrowing_capacity_guide)} rough borrowing guide</h3>
    <p>Estimated affordable repayment: ${formatCurrency(snapshot.affordable_repayment_guide)} per month after a ${snapshot.repayment_buffer_percent}% buffer.</p>
    <dl>
      <div><dt>Income</dt><dd>${formatCurrency(snapshot.monthly_income_estimate)}/mo</dd></div>
      <div><dt>Spending</dt><dd>${formatCurrency(snapshot.monthly_spending_estimate)}/mo</dd></div>
      <div><dt>Surplus</dt><dd>${formatCurrency(snapshot.monthly_surplus_estimate)}/mo</dd></div>
    </dl>
    <p>Based on ${snapshot.months} months, ${snapshot.transaction_count} parsed transactions, and an ${formatNumber(snapshot.assessment_rate)}% assessment-rate guide.</p>
    ${skipped}
  `;
}

function syncAffordabilityHiddenFields(snapshot) {
  const affordabilitySnapshot = document.querySelector("#affordabilitySnapshot");
  const statementFileNames = document.querySelector("#statementFileNames");
  if (affordabilitySnapshot) affordabilitySnapshot.value = snapshot?.ok ? JSON.stringify(snapshot) : "";
  if (statementFileNames) statementFileNames.value = snapshot?.fileNames?.join(", ") || "";
}

function applyEnhancedAffordabilityToLeadForm(snapshot) {
  const leadForm = document.querySelector("#leadForm");
  if (!leadForm || !snapshot) return;
  setLeadValue(leadForm, "loan_amount", snapshot.borrowing_capacity_guide);
  setLeadValue(leadForm, "household_income", snapshot.monthly_income_estimate * 12);
  syncAffordabilityHiddenFields(snapshot);

  const notes = leadForm.elements.notes;
  if (notes) {
    const summary = `Affordability guide: ${formatCurrency(snapshot.borrowing_capacity_guide)} borrowing guide, ${formatCurrency(snapshot.affordable_repayment_guide)}/mo affordable repayment, ${formatCurrency(snapshot.monthly_surplus_estimate)}/mo surplus.`;
    notes.value = notes.value ? `${notes.value}\n\n${summary}` : summary;
  }
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
    .enhanced-file-drop input { background: #ffffff; }
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
    .file-list strong { color: #071427; font-size: 0.92rem; }
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

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function readFormNumber(form, name) {
  return Number(form?.elements[name]?.value || 0);
}

function setLeadValue(form, name, value) {
  const field = form?.elements[name];
  if (field && value !== undefined && value !== null && value !== "") {
    const numericValue = Number(value);
    const step = Number(field.getAttribute("step") || 1);
    field.value = Number.isFinite(numericValue) && step > 1 ? Math.round(numericValue / step) * step : Math.round(numericValue);
  }
}

function principalFromRepayment(payment, annualRate, years, periodsPerYear) {
  const periods = years * periodsPerYear;
  const rate = annualRate / 100 / periodsPerYear;
  if (!payment || !periods) return 0;
  if (!rate) return payment * periods;
  return payment * ((1 - Math.pow(1 + rate, -periods)) / rate);
}

function parseMoneyToken(value) {
  const token = String(value || "").trim();
  if (!/\d/.test(token)) return 0;
  if (!/[$,.\-()]/.test(token)) return 0;
  return parseMoney(token);
}

function parseMoney(value) {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const negative = raw.includes("(") && raw.includes(")") ? -1 : 1;
  const cleaned = raw.replace(/[$,\s()]/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount * negative : 0;
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

function formatCurrency(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const sign = safeValue < 0 ? "-" : "";
  return `${sign}$${Math.abs(safeValue).toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

function formatNumber(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return safeValue.toLocaleString("en-AU", { maximumFractionDigits: 1 });
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function roundCurrency(value) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
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
