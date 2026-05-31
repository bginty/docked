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
  const projectType = formData.get("projectType");
  const business = formData.get("business");
  const email = formData.get("email");
  const domain = formData.get("domain") || "No preferred domain";
  const details = formData.get("details");

  const subject = encodeURIComponent(`Docked build request: ${business}`);
  const body = encodeURIComponent(
    `Business: ${business}\nEmail: ${email}\nProject: ${projectType}\nDomain: ${domain}\n\nBuild request:\n${details}`,
  );

  formStatus.textContent = "Launch brief prepared. Opening email handoff now.";
  window.location.href = `mailto:hello@docked.com.au?subject=${subject}&body=${body}`;
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
