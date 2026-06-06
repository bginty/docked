const SHEET_WEBHOOK_URL = "";

const calculatorTabs = document.querySelectorAll("[data-calculator-tab]");
const calculatorPanels = document.querySelectorAll("[data-calculator-panel]");
const resultTitle = document.querySelector("#resultTitle");
const resultPrimary = document.querySelector("#resultPrimary");
const resultDetail = document.querySelector("#resultDetail");
const heroRepayment = document.querySelector("#heroRepayment");
const copyScenarioButton = document.querySelector("#copyScenarioButton");
const calculatorSnapshot = document.querySelector("#calculatorSnapshot");
const statementForm = document.querySelector("#statementForm");
const statementFiles = document.querySelector("#statementFiles");
const affordabilityResult = document.querySelector("#affordabilityResult");
const useAffordabilityButton = document.querySelector("#useAffordabilityButton");
const affordabilitySnapshot = document.querySelector("#affordabilitySnapshot");
const statementFileNames = document.querySelector("#statementFileNames");
const leadForm = document.querySelector("#leadForm");
const formStatus = document.querySelector("#formStatus");
const dailyArticle = document.querySelector("#dailyArticle");

let activeCalculator = "repayments";
let currentScenario = {};
let latestAffordability = null;

const dailyArticles = [
  {
    title: "How much can I borrow for a home loan?",
    body:
      "Borrowing power is shaped by income, expenses, existing debts, dependants, deposit, credit history, and lender policy. A calculator gives a useful guide, but the number should be checked against actual lender rules before you make decisions.",
  },
  {
    title: "When is refinancing worth checking?",
    body:
      "Refinancing is worth checking when your current rate, fees, features, or loan structure no longer suit you. Compare the repayment saving, switching costs, annual benefit, and break-even time before moving.",
  },
  {
    title: "What deposit do I need to buy property?",
    body:
      "A 20% deposit is a common target because it can reduce the chance of lenders mortgage insurance, but smaller deposits may still work depending on lender policy, income, property type, and available schemes.",
  },
  {
    title: "Should I choose a fixed or variable rate?",
    body:
      "Fixed rates can support repayment certainty. Variable rates may give more flexibility. Some borrowers split their loan between fixed and variable portions to balance certainty with optionality.",
  },
  {
    title: "Can self-employed borrowers get approved?",
    body:
      "Self-employed borrowers can get approved, but the evidence can be different. Brokers often compare tax returns, BAS, business financials, bank statements, loan purpose, and lender appetite.",
  },
  {
    title: "What documents should I prepare for a broker?",
    body:
      "Most brokers ask for ID, income evidence, bank statements, current loan details, living expense information, asset and liability details, and property information if you already have a property in mind.",
  },
  {
    title: "Does using a broker cost the borrower money?",
    body:
      "Many mortgage brokers are paid by the lender if a loan settles, but fees and arrangements can vary. Ask the broker how they are paid, whether any fee applies to you, and which lenders they compare.",
  },
];

calculatorTabs.forEach((button) => {
  button.addEventListener("click", () => {
    activeCalculator = button.dataset.calculatorTab;
    calculatorTabs.forEach((tab) => tab.classList.toggle("active", tab === button));
    calculatorPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.calculatorPanel === activeCalculator));
    updateCalculator();
  });
});

calculatorPanels.forEach((panel) => {
  panel.addEventListener("input", updateCalculator);
  panel.addEventListener("change", updateCalculator);
});

copyScenarioButton?.addEventListener("click", () => {
  if (!leadForm) return;
  applyScenarioToLeadForm();
  document.querySelector("#lead")?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (formStatus) formStatus.textContent = "Calculator scenario added to your enquiry.";
});

statementForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  latestAffordability = await analyseAffordability();
  renderAffordability(latestAffordability);
  if (useAffordabilityButton) useAffordabilityButton.disabled = !latestAffordability.ok;
});

useAffordabilityButton?.addEventListener("click", () => {
  if (!latestAffordability?.ok) return;
  applyAffordabilityToLeadForm(latestAffordability);
  document.querySelector("#lead")?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (formStatus) formStatus.textContent = "Affordability result added to your help request.";
});

leadForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!leadForm.reportValidity()) return;

  if (calculatorSnapshot) {
    calculatorSnapshot.value = JSON.stringify(currentScenario);
  }
  if (affordabilitySnapshot && latestAffordability?.ok) {
    affordabilitySnapshot.value = JSON.stringify(latestAffordability);
  }
  if (statementFileNames && latestAffordability?.fileNames) {
    statementFileNames.value = latestAffordability.fileNames.join(", ");
  }

  const formData = new FormData(leadForm);
  const result = await saveLead("loan_help_requested", formData, {
    calculator_snapshot: JSON.stringify(currentScenario),
    affordability_snapshot: latestAffordability?.ok ? JSON.stringify(latestAffordability) : "",
    statement_file_names: latestAffordability?.fileNames?.join(", ") || "",
    statement_months: latestAffordability?.months || "",
    analysis_method: latestAffordability?.analysis_method || "",
    monthly_income_estimate: latestAffordability?.monthly_income_estimate || "",
    monthly_spending_estimate: latestAffordability?.monthly_spending_estimate || "",
    monthly_debt_repayments: latestAffordability?.monthly_debt_repayments || "",
    monthly_surplus_estimate: latestAffordability?.monthly_surplus_estimate || "",
    affordable_repayment_guide: latestAffordability?.affordable_repayment_guide || "",
    borrowing_capacity_guide: latestAffordability?.borrowing_capacity_guide || "",
    consent_recorded: "yes",
  });

  formStatus.textContent = result.sent
    ? "Thanks, your loan help request has been received."
    : "Thanks, your loan help request is ready. Connect the Google Sheet webhook to capture it automatically.";
  leadForm.reset();
  if (calculatorSnapshot) calculatorSnapshot.value = "";
  if (affordabilitySnapshot) affordabilitySnapshot.value = "";
  if (statementFileNames) statementFileNames.value = "";
});

renderDailyArticle();
updateCalculator();

function updateCalculator() {
  const calculators = {
    repayments: calculateRepayments,
    borrowing: calculateBorrowingPower,
    refinance: calculateRefinance,
    deposit: calculateDeposit,
    extra: calculateExtraRepayments,
  };

  const calculation = calculators[activeCalculator]?.();
  if (!calculation) return;

  currentScenario = {
    calculator: activeCalculator,
    title: calculation.title,
    primary: calculation.primary,
    detail: calculation.detail,
    values: calculation.values,
    calculated_at: new Date().toISOString(),
  };

  if (resultTitle) resultTitle.textContent = calculation.title;
  if (resultPrimary) resultPrimary.textContent = calculation.primary;
  if (resultDetail) resultDetail.textContent = calculation.detail;
  if (calculatorSnapshot) calculatorSnapshot.value = JSON.stringify(currentScenario);

  if (heroRepayment && activeCalculator === "repayments") {
    heroRepayment.textContent = calculation.primary;
  }
}

function calculateRepayments() {
  const form = document.querySelector("#repaymentsCalc");
  const loan = readNumber(form, "loan_amount");
  const rate = readNumber(form, "interest_rate");
  const years = readNumber(form, "loan_term_years");
  const frequency = form?.elements.repayment_frequency?.value || "monthly";
  const periods = frequency === "weekly" ? 52 : frequency === "fortnightly" ? 26 : 12;
  const repayment = repaymentAmount(loan, rate, years, periods);
  const totalInterest = Math.max(0, repayment * years * periods - loan);

  return {
    title: `${capitalise(frequency)} repayment`,
    primary: formatCurrency(repayment),
    detail: `Total interest estimate: ${formatCurrency(totalInterest)} over ${years} years.`,
    values: {
      loan_amount: loan,
      interest_rate: rate,
      loan_term_years: years,
      repayment_frequency: frequency,
      repayment: roundCurrency(repayment),
      total_interest: roundCurrency(totalInterest),
    },
  };
}

function calculateBorrowingPower() {
  const form = document.querySelector("#borrowingCalc");
  const income = readNumber(form, "household_income");
  const expenses = readNumber(form, "monthly_expenses");
  const debts = readNumber(form, "other_debt_repayments");
  const dependants = readNumber(form, "dependants");
  const monthlyIncome = income / 12;
  const dependantBuffer = dependants * 350;
  const serviceableMonthly = Math.max(0, monthlyIncome * 0.5 - expenses - debts - dependantBuffer);
  const assessmentRate = 8.5;
  const years = 30;
  const guide = principalFromRepayment(serviceableMonthly, assessmentRate, years, 12);

  return {
    title: "Borrowing power guide",
    primary: formatCurrency(guide),
    detail: `Based on an assessment rate of ${assessmentRate.toFixed(2)}% and an estimated serviceable repayment guide of ${formatCurrency(serviceableMonthly)} per month.`,
    values: {
      household_income: income,
      monthly_expenses: expenses,
      other_debt_repayments: debts,
      dependants,
      assessment_rate: assessmentRate,
      estimated_serviceable_monthly_repayment: roundCurrency(serviceableMonthly),
      borrowing_power_guide: roundCurrency(guide),
    },
  };
}

function calculateRefinance() {
  const form = document.querySelector("#refinanceCalc");
  const balance = readNumber(form, "current_balance");
  const currentRate = readNumber(form, "current_rate");
  const newRate = readNumber(form, "new_rate");
  const years = readNumber(form, "remaining_term_years");
  const costs = readNumber(form, "switching_costs");
  const currentMonthly = repaymentAmount(balance, currentRate, years, 12);
  const newMonthly = repaymentAmount(balance, newRate, years, 12);
  const monthlySaving = currentMonthly - newMonthly;
  const annualSaving = monthlySaving * 12;
  const breakEven = monthlySaving > 0 ? Math.ceil(costs / monthlySaving) : 0;

  return {
    title: "Estimated monthly saving",
    primary: formatCurrency(monthlySaving),
    detail:
      monthlySaving > 0
        ? `Annual saving estimate: ${formatCurrency(annualSaving)}. Break-even after about ${breakEven} months.`
        : "The new rate does not show a repayment saving on these inputs.",
    values: {
      current_balance: balance,
      current_rate: currentRate,
      new_rate: newRate,
      remaining_term_years: years,
      switching_costs: costs,
      current_monthly_repayment: roundCurrency(currentMonthly),
      new_monthly_repayment: roundCurrency(newMonthly),
      monthly_saving: roundCurrency(monthlySaving),
      annual_saving: roundCurrency(annualSaving),
      break_even_months: breakEven,
    },
  };
}

function calculateDeposit() {
  const form = document.querySelector("#depositCalc");
  const price = readNumber(form, "property_price");
  const deposit = readNumber(form, "deposit_equity");
  const upfrontCosts = readNumber(form, "upfront_costs");
  const targetLvr = readNumber(form, "target_lvr");
  const usableDeposit = Math.max(0, deposit - upfrontCosts);
  const loan = Math.max(0, price - usableDeposit);
  const lvr = price > 0 ? (loan / price) * 100 : 0;
  const targetDeposit = price * (1 - targetLvr / 100) + upfrontCosts;
  const gap = Math.max(0, targetDeposit - deposit);

  return {
    title: "Estimated LVR",
    primary: `${formatNumber(lvr)}%`,
    detail:
      gap > 0
        ? `Estimated loan size: ${formatCurrency(loan)}. Deposit gap to reach ${formatNumber(targetLvr)}% LVR: ${formatCurrency(gap)}.`
        : `Estimated loan size: ${formatCurrency(loan)}. You appear to meet the ${formatNumber(targetLvr)}% LVR target on these inputs.`,
    values: {
      property_price: price,
      deposit_equity: deposit,
      upfront_costs: upfrontCosts,
      usable_deposit: roundCurrency(usableDeposit),
      estimated_loan_size: roundCurrency(loan),
      estimated_lvr: roundCurrency(lvr),
      target_lvr: targetLvr,
      deposit_gap: roundCurrency(gap),
    },
  };
}

function calculateExtraRepayments() {
  const form = document.querySelector("#extraCalc");
  const balance = readNumber(form, "extra_balance");
  const rate = readNumber(form, "extra_rate");
  const years = readNumber(form, "extra_term_years");
  const extra = readNumber(form, "extra_monthly");
  const baseRepayment = repaymentAmount(balance, rate, years, 12);
  const baseInterest = Math.max(0, baseRepayment * years * 12 - balance);
  const accelerated = simulatePayoff(balance, rate, baseRepayment + extra, years * 12);
  const interestSaved = Math.max(0, baseInterest - accelerated.interest);
  const monthsSaved = Math.max(0, years * 12 - accelerated.months);

  return {
    title: "Estimated interest saved",
    primary: formatCurrency(interestSaved),
    detail: `Estimated time saved: ${monthsToYears(monthsSaved)}. New payoff time: ${monthsToYears(accelerated.months)}.`,
    values: {
      loan_balance: balance,
      interest_rate: rate,
      remaining_term_years: years,
      standard_monthly_repayment: roundCurrency(baseRepayment),
      extra_monthly_repayment: extra,
      estimated_interest_saved: roundCurrency(interestSaved),
      estimated_months_saved: monthsSaved,
      estimated_payoff_months: accelerated.months,
    },
  };
}

function repaymentAmount(principal, annualRate, years, periodsPerYear) {
  const periods = years * periodsPerYear;
  if (!principal || !periods) return 0;
  const rate = annualRate / 100 / periodsPerYear;
  if (!rate) return principal / periods;
  return (principal * rate) / (1 - Math.pow(1 + rate, -periods));
}

function principalFromRepayment(payment, annualRate, years, periodsPerYear) {
  const periods = years * periodsPerYear;
  const rate = annualRate / 100 / periodsPerYear;
  if (!payment || !periods) return 0;
  if (!rate) return payment * periods;
  return payment * ((1 - Math.pow(1 + rate, -periods)) / rate);
}

function simulatePayoff(balance, annualRate, monthlyPayment, maxMonths) {
  const monthlyRate = annualRate / 100 / 12;
  let remaining = balance;
  let interest = 0;
  let months = 0;

  while (remaining > 0 && months < maxMonths * 2 && monthlyPayment > 0) {
    const monthlyInterest = remaining * monthlyRate;
    const principalPaid = monthlyPayment - monthlyInterest;
    if (principalPaid <= 0) break;
    remaining -= principalPaid;
    interest += monthlyInterest;
    months += 1;
  }

  return {
    months,
    interest,
  };
}

function applyScenarioToLeadForm() {
  const values = currentScenario.values || {};
  setLeadValue("loan_amount", values.loan_amount || values.current_balance || values.estimated_loan_size || values.loan_balance);
  setLeadValue("property_value", values.property_price);
  setLeadValue("deposit_equity", values.deposit_equity);
  setLeadValue("household_income", values.household_income);
}

async function analyseAffordability() {
  const form = statementForm;
  const months = Math.max(1, readNumber(form, "statement_months") || 3);
  const dependants = readNumber(form, "statement_dependants");
  const debts = readNumber(form, "statement_debts");
  const bufferPercent = readNumber(form, "statement_buffer") || 25;
  const manualIncome = readNumber(form, "manual_income");
  const manualSpending = readNumber(form, "manual_spending");
  const files = Array.from(statementFiles?.files || []).slice(0, 6);
  const parsed = await parseStatementFiles(files, months);

  const monthlyIncome = manualIncome || parsed.monthlyIncome;
  const monthlySpending = manualSpending || parsed.monthlySpending;

  if (!monthlyIncome || !monthlySpending) {
    return {
      ok: false,
      message: "Upload a CSV/TXT/OFX/QIF statement export with debit and credit amounts, or enter monthly income and spending manually.",
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
    analysis_method: manualIncome || manualSpending ? "Manual figures with statement upload note" : "Browser statement export estimate",
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

async function parseStatementFiles(files, months) {
  const totals = {
    income: 0,
    spending: 0,
    transactionCount: 0,
    skippedFiles: [],
  };

  for (const file of files) {
    if (/\.pdf$/i.test(file.name)) {
      totals.skippedFiles.push(`${file.name}: PDF noted, not parsed in browser`);
      continue;
    }

    try {
      const text = await readFileAsText(file);
      const parsed = parseStatementText(text);
      totals.income += parsed.income;
      totals.spending += parsed.spending;
      totals.transactionCount += parsed.transactionCount;
      if (!parsed.transactionCount) totals.skippedFiles.push(`${file.name}: no debit/credit amounts found`);
    } catch {
      totals.skippedFiles.push(`${file.name}: could not read file`);
    }
  }

  return {
    monthlyIncome: totals.income / months,
    monthlySpending: totals.spending / months,
    transactionCount: totals.transactionCount,
    skippedFiles: totals.skippedFiles,
  };
}

function parseStatementText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return { income: 0, spending: 0, transactionCount: 0 };

  const header = parseDelimitedLine(lines[0]).map((cell) => cell.toLowerCase());
  const debitIndex = findHeaderIndex(header, ["debit", "withdrawal", "money out", "payment", "spent", "debit amount"]);
  const creditIndex = findHeaderIndex(header, ["credit", "deposit", "money in", "received", "credit amount"]);
  const amountIndex = findHeaderIndex(header, ["amount", "transaction amount", "value"]);

  if (debitIndex >= 0 || creditIndex >= 0 || amountIndex >= 0) {
    return parseStatementRows(lines.slice(1), { debitIndex, creditIndex, amountIndex });
  }

  return parseSignedAmountRows(lines);
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

function findHeaderIndex(headers, candidates) {
  return headers.findIndex((header) => candidates.some((candidate) => header.includes(candidate)));
}

function parseMoney(value) {
  if (value === undefined || value === null) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const negative = raw.includes("(") && raw.includes(")") ? -1 : 1;
  const cleaned = raw.replace(/[$,\s()]/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount * negative : 0;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function renderAffordability(snapshot) {
  if (!affordabilityResult) return;

  if (!snapshot?.ok) {
    affordabilityResult.innerHTML = `
      <p class="eyebrow">Result</p>
      <h3>More information needed</h3>
      <p>${escapeHtml(snapshot?.message || "Upload statement exports or enter figures manually to start.")}</p>
    `;
    return;
  }

  const skipped = snapshot.skippedFiles?.length
    ? `<p>${escapeHtml(snapshot.skippedFiles.join(" "))}</p>`
    : "";

  affordabilityResult.innerHTML = `
    <p class="eyebrow">${escapeHtml(snapshot.status)}</p>
    <h3>${formatCurrency(snapshot.borrowing_capacity_guide)} rough borrowing guide</h3>
    <p>Estimated affordable repayment: ${formatCurrency(snapshot.affordable_repayment_guide)} per month after a ${snapshot.repayment_buffer_percent}% buffer.</p>
    <dl>
      <div><dt>Income</dt><dd>${formatCurrency(snapshot.monthly_income_estimate)}/mo</dd></div>
      <div><dt>Spending</dt><dd>${formatCurrency(snapshot.monthly_spending_estimate)}/mo</dd></div>
      <div><dt>Surplus</dt><dd>${formatCurrency(snapshot.monthly_surplus_estimate)}/mo</dd></div>
    </dl>
    <p>Based on ${snapshot.months} month${snapshot.months === 1 ? "" : "s"}, ${snapshot.transaction_count} parsed transactions, and an ${snapshot.assessment_rate.toFixed(2)}% assessment-rate guide.</p>
    ${skipped}
  `;
}

function applyAffordabilityToLeadForm(snapshot) {
  if (!leadForm || !snapshot) return;
  setLeadValue("loan_amount", snapshot.borrowing_capacity_guide);
  setLeadValue("household_income", snapshot.monthly_income_estimate * 12);
  if (affordabilitySnapshot) affordabilitySnapshot.value = JSON.stringify(snapshot);
  if (statementFileNames) statementFileNames.value = snapshot.fileNames.join(", ");

  const notes = leadForm.elements.notes;
  if (notes) {
    const summary = `Affordability guide: ${formatCurrency(snapshot.borrowing_capacity_guide)} borrowing guide, ${formatCurrency(snapshot.affordable_repayment_guide)}/mo affordable repayment, ${formatCurrency(snapshot.monthly_surplus_estimate)}/mo surplus.`;
    notes.value = notes.value ? `${notes.value}\n\n${summary}` : summary;
  }
}

async function saveLead(stage, formData, extra = {}) {
  const payload = {
    submitted_at: new Date().toISOString(),
    ...formDataToObject(formData),
    stage,
    ...extra,
  };

  storeLocalLead(payload);

  if (!SHEET_WEBHOOK_URL) {
    return { sent: false, local: true };
  }

  try {
    await fetch(SHEET_WEBHOOK_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    return { sent: true, local: true };
  } catch {
    return { sent: false, local: true };
  }
}

function storeLocalLead(payload) {
  const existing = JSON.parse(localStorage.getItem("docked_loan_leads") || "[]");
  existing.push(payload);
  localStorage.setItem("docked_loan_leads", JSON.stringify(existing.slice(-75)));
}

function formDataToObject(formData) {
  const output = {};
  for (const [key, value] of formData.entries()) {
    if (!value) continue;
    if (output[key]) output[key] = `${output[key]}, ${value}`;
    else output[key] = value;
  }
  return output;
}

function renderDailyArticle() {
  if (!dailyArticle) return;
  const dayIndex = Math.floor(Date.now() / 86400000) % dailyArticles.length;
  const article = dailyArticles[dayIndex];
  dailyArticle.innerHTML = `
    <h3>${escapeHtml(article.title)}</h3>
    <p>${escapeHtml(article.body)}</p>
    <a class="button secondary" href="#lead">Ask a broker</a>
  `;
}

function readNumber(form, name) {
  return Number(form?.elements[name]?.value || 0);
}

function setLeadValue(name, value) {
  const field = leadForm?.elements[name];
  if (field && value !== undefined && value !== null && value !== "") {
    const numericValue = Number(value);
    const step = Number(field.getAttribute("step") || 1);
    field.value = Number.isFinite(numericValue) && step > 1 ? Math.round(numericValue / step) * step : Math.round(numericValue);
  }
}

function formatCurrency(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const sign = safeValue < 0 ? "-" : "";
  return `${sign}$${Math.abs(safeValue).toLocaleString("en-AU", {
    maximumFractionDigits: 0,
  })}`;
}

function formatNumber(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return safeValue.toLocaleString("en-AU", {
    maximumFractionDigits: 1,
  });
}

function roundCurrency(value) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function monthsToYears(months) {
  if (!months) return "0 months";
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (!years) return `${remainingMonths} month${remainingMonths === 1 ? "" : "s"}`;
  if (!remainingMonths) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"} ${remainingMonths} month${remainingMonths === 1 ? "" : "s"}`;
}

function capitalise(value) {
  return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
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
