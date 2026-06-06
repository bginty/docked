const SHEET_WEBHOOK_URL = "";

const calculatorTabs = document.querySelectorAll("[data-calculator-tab]");
const calculatorPanels = document.querySelectorAll("[data-calculator-panel]");
const resultTitle = document.querySelector("#resultTitle");
const resultPrimary = document.querySelector("#resultPrimary");
const resultDetail = document.querySelector("#resultDetail");
const heroRepayment = document.querySelector("#heroRepayment");
const copyScenarioButton = document.querySelector("#copyScenarioButton");
const calculatorSnapshot = document.querySelector("#calculatorSnapshot");
const leadForm = document.querySelector("#leadForm");
const formStatus = document.querySelector("#formStatus");
const dailyArticle = document.querySelector("#dailyArticle");

let activeCalculator = "repayments";
let currentScenario = {};

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

leadForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!leadForm.reportValidity()) return;

  if (calculatorSnapshot) {
    calculatorSnapshot.value = JSON.stringify(currentScenario);
  }

  const formData = new FormData(leadForm);
  const result = await saveLead("loan_lead_requested", formData, {
    calculator_snapshot: JSON.stringify(currentScenario),
    consent_recorded: "yes",
  });

  formStatus.textContent = result.sent
    ? "Thanks, your broker match request has been received."
    : "Thanks, your broker match request is ready. Connect the Google Sheet webhook to capture it automatically.";
  leadForm.reset();
  if (calculatorSnapshot) calculatorSnapshot.value = "";
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
    field.value = Math.round(Number(value));
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
