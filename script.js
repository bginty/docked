const taskSets = {
  logo: ["Analyse brand cues", "Generate logo routes", "Prepare colour variants", "Package export files"],
  booking: ["Map booking action", "Add homepage CTA", "Connect booking destination", "Publish after approval"],
  price: ["Find pricing mentions", "Update offer copy", "Check mobile layout", "Publish after approval"],
  domain: ["Check domain options", "Prepare registration task", "Connect DNS records", "Confirm launch path"],
  default: ["Interpret request", "Generate draft", "Send preview", "Publish after approval"],
};

const automationForm = document.querySelector("#automationForm");
const requestText = document.querySelector("#requestText");
const chatLog = document.querySelector("#chatLog");
const taskList = document.querySelector("#taskList");
const briefForm = document.querySelector("#briefForm");
const formStatus = document.querySelector("#formStatus");
const domainInput = document.querySelector("#domainInput");
const domainCheckLink = document.querySelector("#domainCheckLink");
const godaddyCheckField = document.querySelector("#godaddyCheckField");
const approvalForm = document.querySelector("#approvalForm");
const approvalStatus = document.querySelector("#approvalStatus");

function pickTasks(value) {
  const lower = value.toLowerCase();
  if (lower.includes("logo") || lower.includes("brand")) return taskSets.logo;
  if (lower.includes("book") || lower.includes("call") || lower.includes("appointment")) return taskSets.booking;
  if (lower.includes("price") || lower.includes("$") || lower.includes("cost")) return taskSets.price;
  if (lower.includes("domain") || lower.includes(".com")) return taskSets.domain;
  return taskSets.default;
}

function renderTasks(tasks) {
  taskList.innerHTML = tasks.map((task) => `<li><span></span> ${task}</li>`).join("");
}

automationForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const request = requestText.value.trim();
  if (!request) return;

  const tasks = pickTasks(request);
  chatLog.insertAdjacentHTML("beforeend", `<div class="message incoming">${escapeHtml(request)}</div>`);
  chatLog.insertAdjacentHTML(
    "beforeend",
    `<div class="message outgoing">Queued: ${tasks.join(", ").toLowerCase()}.</div>`,
  );
  renderTasks(tasks);
  requestText.value = "";
  chatLog.scrollTop = chatLog.scrollHeight;
});

briefForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(briefForm);
  const business = formData.get("business");
  updateDomainCheckLink();
  openMailDraft({
    subject: `New Docked preview request${business ? `: ${business}` : ""}`,
    formData,
  });
  formStatus.textContent = `Email prepared for ${business || "the"} preview request.`;
});

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
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

function updateDomainCheckLink() {
  const rawDomain = domainInput?.value.trim();
  const baseUrl = "https://www.godaddy.com/en-au/domainsearch/find";
  const url = rawDomain
    ? `${baseUrl}?domainToCheck=${encodeURIComponent(rawDomain)}`
    : "https://www.godaddy.com/en-au/domains";

  if (domainCheckLink) domainCheckLink.href = url;
  if (godaddyCheckField) godaddyCheckField.value = url;
}

domainInput?.addEventListener("input", updateDomainCheckLink);
updateDomainCheckLink();

approvalForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(approvalForm);
  const business = formData.get("approved_business");
  openMailDraft({
    subject: `Docked preview approved${business ? `: ${business}` : ""}`,
    formData,
  });
  approvalStatus.textContent = "Approval email prepared for Docked.";
});

if (window.paypal?.HostedButtons) {
  paypal.HostedButtons({
    hostedButtonId: "ZGTCFXXGBGNKU",
  }).render("#paypal-container-ZGTCFXXGBGNKU");
}

function openMailDraft({ subject, formData }) {
  const lines = [];
  for (const [key, value] of formData.entries()) {
    if (!value) continue;
    const label = key.replaceAll("_", " ");
    lines.push(`${label}: ${value}`);
  }

  const body = encodeURIComponent(lines.join("\n"));
  const encodedSubject = encodeURIComponent(subject);
  window.location.href = `mailto:briantginty21@gmail.com?subject=${encodedSubject}&body=${body}`;
}
