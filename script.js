const SHEET_WEBHOOK_URL = "";

const taskSets = {
  logo: ["Analyse brand cues", "Generate logo routes", "Prepare colour variants", "Package export files"],
  booking: ["Map booking action", "Add homepage CTA", "Connect booking destination", "Publish after approval"],
  price: ["Find pricing mentions", "Update offer copy", "Check mobile layout", "Publish after approval"],
  domain: ["Check domain options", "Prepare registration task", "Connect DNS records", "Confirm launch path"],
  default: ["Interpret request", "Generate draft", "Send preview", "Publish after approval"],
};

const palettes = {
  premium: {
    name: "Premium",
    colors: ["#073f43", "#f46f5f", "#fffaf3"],
    mood: "confident, polished, and conversion-focused",
  },
  fresh: {
    name: "Fresh",
    colors: ["#0d9488", "#f7c948", "#f8fafc"],
    mood: "friendly, modern, and easy to trust",
  },
  minimal: {
    name: "Minimal",
    colors: ["#18262a", "#d3a34c", "#ffffff"],
    mood: "clean, direct, and professional",
  },
  energetic: {
    name: "Energetic",
    colors: ["#2f5bea", "#f46f5f", "#fff7ed"],
    mood: "bright, active, and launch-ready",
  },
};

const automationForm = document.querySelector("#automationForm");
const requestText = document.querySelector("#requestText");
const chatLog = document.querySelector("#chatLog");
const taskList = document.querySelector("#taskList");
const briefForm = document.querySelector("#briefForm");
const formStatus = document.querySelector("#formStatus");
const domainInput = document.querySelector("#domainInput");
const domainCheckButton = document.querySelector("#domainCheckButton");
const domainStatus = document.querySelector("#domainStatus");
const domainStatusField = document.querySelector("#domainStatusField");
const domainLookupSourceField = document.querySelector("#domainLookupSourceField");
const previewSnapshotField = document.querySelector("#previewSnapshotField");
const approvedPreviewSnapshotField = document.querySelector("#approvedPreviewSnapshotField");
const approvalForm = document.querySelector("#approvalForm");
const approvalStatus = document.querySelector("#approvalStatus");
const agentChat = document.querySelector("#agentChat");
const revisionForm = document.querySelector("#revisionForm");
const revisionText = document.querySelector("#revisionText");
const acceptPreviewButton = document.querySelector("#acceptPreviewButton");
const downloadPreviewButton = document.querySelector("#downloadPreviewButton");
const sitePreviewImage = document.querySelector("#sitePreviewImage");
const previewDomain = document.querySelector("#previewDomain");
const previewBusiness = document.querySelector("#previewBusiness");
const generatedLogo = document.querySelector("#generatedLogo");
const previewKicker = document.querySelector("#previewKicker");
const previewHeadline = document.querySelector("#previewHeadline");
const previewSubcopy = document.querySelector("#previewSubcopy");
const previewServices = document.querySelector("#previewServices");

let previewState = null;
let rdapBootstrap = null;

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

briefForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!briefForm.reportValidity()) return;

  const formData = new FormData(briefForm);
  const domain = normalizeDomain(formData.get("preferred_domain"));
  if (domain && domainInput) {
    domainInput.value = domain;
    formData.set("preferred_domain", domain);
  }

  previewState = createPreview(formData);
  renderGeneratedPreview(previewState);
  setPreviewSnapshot(previewState);
  setPreviewControlsEnabled(true);
  appendAgentMessage(
    `I generated a ${previewState.style.name.toLowerCase()} preview for ${previewState.business}. Ask for changes below, or approve it when it feels right.`,
  );
  await saveLead("preview_generated", formData, {
    preview_snapshot: JSON.stringify(previewState),
  });

  formStatus.textContent = "Preview generated below. Ask for changes or approve when happy.";
  document.querySelector("#preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

domainInput?.addEventListener("blur", () => {
  const domain = normalizeDomain(domainInput.value);
  if (domain) domainInput.value = domain;
});

domainCheckButton?.addEventListener("click", async () => {
  const domain = normalizeDomain(domainInput?.value);
  if (!domain) {
    setDomainStatus("Enter a domain first, for example yourbusiness.com.au.", "unknown");
    return;
  }

  domainInput.value = domain;
  domainCheckButton.disabled = true;
  setDomainStatus(`Checking ${domain} against the registry...`, "checking");

  try {
    const result = await lookupDomain(domain);
    setDomainStatus(result.message, result.status);
    if (domainStatusField) domainStatusField.value = `${result.status}: ${result.message}`;
    if (domainLookupSourceField) domainLookupSourceField.value = result.source || "RDAP";
  } catch {
    setDomainStatus("Could not confirm automatically. Docked will check this domain before purchase.", "unknown");
    if (domainStatusField) domainStatusField.value = "Automatic check failed - manual check needed";
  } finally {
    domainCheckButton.disabled = false;
  }
});

revisionForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!previewState) return;

  const request = revisionText.value.trim();
  if (!request) return;

  appendAgentMessage(request, "incoming");
  applyRevision(previewState, request);
  renderGeneratedPreview(previewState);
  setPreviewSnapshot(previewState);
  appendAgentMessage(`Updated preview: ${summariseRevision(request)}.`);
  revisionText.value = "";

  await saveLead("preview_revision", new FormData(briefForm), {
    revision_request: request,
    preview_snapshot: JSON.stringify(previewState),
  });
});

acceptPreviewButton?.addEventListener("click", async () => {
  if (!previewState || !approvalForm) return;

  fillApprovalForm(previewState);
  appendAgentMessage("Preview approved. I have moved the launch details into the approval step.");
  await saveLead("preview_accepted", new FormData(briefForm), {
    preview_snapshot: JSON.stringify(previewState),
  });

  approvalStatus.textContent = "Preview accepted. Complete the approval details and PayPal payment below.";
  document.querySelector("#approve")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

downloadPreviewButton?.addEventListener("click", () => {
  if (!previewState) return;
  downloadTextFile(`${slugify(previewState.business)}-docked-preview.svg`, buildPreviewSvg(previewState), "image/svg+xml");
});

approvalForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!approvalForm.reportValidity()) return;

  const formData = new FormData(approvalForm);
  if (previewState) {
    formData.set("approved_preview_snapshot", JSON.stringify(previewState));
  }

  const result = await saveLead("approval_submitted", formData, {
    payment_provider: "PayPal",
    subscription_price: "AUD 30 per month",
    domain_buyout_price: "AUD 499",
  });

  approvalStatus.textContent = result.sent
    ? "Approval details saved. Please complete PayPal if you have not already."
    : "Approval details are ready. Spreadsheet capture will be connected before live customer intake.";
});

function createPreview(formData) {
  const business = cleanValue(formData.get("business")) || "Your business";
  const projectType = cleanValue(formData.get("projectType")) || "Website";
  const domain = normalizeDomain(formData.get("preferred_domain")) || `${slugify(business)}.com.au`;
  const details = cleanValue(formData.get("details"));
  const previewRequirements = cleanValue(formData.get("preview_requirements"));
  const combined = `${business} ${details} ${previewRequirements} ${projectType}`.toLowerCase();
  const style = chooseStyle(combined);
  const services = chooseServices(combined, projectType);

  return {
    business,
    email: cleanValue(formData.get("email")),
    phone: cleanValue(formData.get("phone")),
    current_website: cleanValue(formData.get("current_website")),
    project_type: projectType,
    domain,
    style,
    services,
    headline: buildHeadline(business, combined, projectType),
    subcopy: buildSubcopy(business, combined, projectType),
    kicker: `${style.name} ${projectType.toLowerCase()} preview`,
    changes: [],
    generated_at: new Date().toISOString(),
  };
}

function chooseStyle(value) {
  if (value.includes("premium") || value.includes("luxury") || value.includes("high end")) return { ...palettes.premium };
  if (value.includes("minimal") || value.includes("simple") || value.includes("clean")) return { ...palettes.minimal };
  if (value.includes("bright") || value.includes("bold") || value.includes("fun") || value.includes("colour")) {
    return { ...palettes.energetic };
  }
  return { ...palettes.fresh };
}

function chooseServices(value, projectType) {
  const services = [];
  if (projectType.toLowerCase().includes("logo")) services.push("Logo routes");
  if (value.includes("book") || value.includes("appointment")) services.push("Booking");
  if (value.includes("quote") || value.includes("estimate")) services.push("Quote form");
  if (value.includes("shop") || value.includes("product")) services.push("Products");
  if (value.includes("gallery") || value.includes("photo")) services.push("Gallery");
  if (value.includes("menu")) services.push("Menu");
  if (value.includes("service")) services.push("Services");
  services.push("Homepage", "Contact");
  return [...new Set(services)].slice(0, 5);
}

function buildHeadline(business, value, projectType) {
  if (projectType === "Logo") return `${business} brand direction`;
  if (value.includes("book")) return `${business} bookings made simple`;
  if (value.includes("quote")) return `Get a fast quote from ${business}`;
  return `${business}, ready to launch`;
}

function buildSubcopy(business, value, projectType) {
  if (projectType === "Logo") {
    return `A generated logo system for ${business}, with colours, usage direction, and export-ready assets.`;
  }
  if (value.includes("premium") || value.includes("luxury")) {
    return `A polished site direction for ${business}, designed to build trust quickly and move visitors toward enquiry.`;
  }
  return `A clear website direction for ${business}, with the key sections, calls to action, and launch path mapped out.`;
}

function renderGeneratedPreview(snapshot) {
  const [primary, accent, background] = snapshot.style.colors;
  sitePreviewImage?.style.setProperty("--preview-primary", primary);
  sitePreviewImage?.style.setProperty("--preview-accent", accent);
  sitePreviewImage?.style.setProperty("--preview-bg", background);

  if (previewDomain) previewDomain.textContent = snapshot.domain;
  if (previewBusiness) previewBusiness.textContent = snapshot.business;
  if (generatedLogo) generatedLogo.textContent = initials(snapshot.business);
  if (previewKicker) previewKicker.textContent = snapshot.kicker;
  if (previewHeadline) previewHeadline.textContent = snapshot.headline;
  if (previewSubcopy) previewSubcopy.textContent = snapshot.subcopy;
  if (previewServices) {
    previewServices.innerHTML = snapshot.services.map((service) => `<span>${escapeHtml(service)}</span>`).join("");
  }
}

function applyRevision(snapshot, request) {
  const lower = request.toLowerCase();
  snapshot.changes.push({
    request,
    changed_at: new Date().toISOString(),
  });

  if (lower.includes("premium") || lower.includes("luxury")) snapshot.style = { ...palettes.premium };
  if (lower.includes("minimal") || lower.includes("clean")) snapshot.style = { ...palettes.minimal };
  if (lower.includes("bright") || lower.includes("bold") || lower.includes("colour") || lower.includes("coral")) {
    snapshot.style = { ...palettes.energetic };
  }
  if (lower.includes("green") || lower.includes("teal")) snapshot.style = { ...palettes.fresh };
  if (lower.includes("booking") || lower.includes("book")) snapshot.services = addService(snapshot.services, "Booking");
  if (lower.includes("quote")) snapshot.services = addService(snapshot.services, "Quote form");
  if (lower.includes("gallery") || lower.includes("photo")) snapshot.services = addService(snapshot.services, "Gallery");
  if (lower.includes("logo") || lower.includes("brand")) snapshot.services = addService(snapshot.services, "Logo routes");
  if (lower.includes("more direct")) snapshot.headline = `Work with ${snapshot.business} today`;
  snapshot.kicker = `${snapshot.style.name} preview, revised`;
}

function summariseRevision(request) {
  const tasks = pickTasks(request);
  return tasks.join(", ").toLowerCase();
}

function setPreviewControlsEnabled(enabled) {
  if (revisionText) revisionText.disabled = !enabled;
  revisionForm?.querySelector("button")?.toggleAttribute("disabled", !enabled);
  acceptPreviewButton?.toggleAttribute("disabled", !enabled);
  downloadPreviewButton?.toggleAttribute("disabled", !enabled);
}

function fillApprovalForm(snapshot) {
  approvalForm.elements.approved_business.value = snapshot.business;
  approvalForm.elements.approved_email.value = snapshot.email || "";
  approvalForm.elements.approved_domain.value = snapshot.domain;
  approvalForm.elements.preview_link.value = `Generated Docked preview - ${new Date(snapshot.generated_at).toLocaleString("en-AU")}`;
  setPreviewSnapshot(snapshot);
}

function setPreviewSnapshot(snapshot) {
  const value = JSON.stringify(snapshot);
  if (previewSnapshotField) previewSnapshotField.value = value;
  if (approvedPreviewSnapshotField) approvedPreviewSnapshotField.value = value;
}

async function lookupDomain(domain) {
  const baseUrl = await getRdapBaseUrl(domain);
  if (!baseUrl) {
    return {
      status: "unknown",
      message: "No public registry lookup was found for this domain ending. Docked will confirm manually.",
      source: "No RDAP endpoint",
    };
  }

  const source = `${baseUrl.replace(/\/+$/, "")}/domain/${encodeURIComponent(domain)}`;
  const response = await fetch(source, {
    headers: { Accept: "application/rdap+json, application/json" },
  });

  if (response.status === 404) {
    return {
      status: "likely_available",
      message: `${domain} is not showing in the registry. Docked will confirm final availability before purchase.`,
      source,
    };
  }

  if (response.status === 200) {
    const data = await response.json().catch(() => ({}));
    const registrar = findRegistrar(data);
    return {
      status: "registered",
      message: `${domain} is already registered${registrar ? ` with ${registrar}` : ""}. Try another option.`,
      source,
    };
  }

  return {
    status: "unknown",
    message: `The registry returned status ${response.status}. Docked will confirm manually before purchase.`,
    source,
  };
}

async function getRdapBaseUrl(domain) {
  const labels = domain.split(".");
  const tld = labels[labels.length - 1];
  if (tld === "au") return "https://rdap.cctld.au/rdap/";

  if (!rdapBootstrap) {
    const response = await fetch("https://data.iana.org/rdap/dns.json");
    rdapBootstrap = await response.json();
  }

  const service = rdapBootstrap.services.find(([tlds]) => tlds.includes(tld));
  return service?.[1]?.[0] || null;
}

function findRegistrar(data) {
  const registrar = data.entities?.find((entity) => entity.roles?.includes("registrar"));
  const vcard = registrar?.vcardArray?.[1] || [];
  const fn = vcard.find((item) => item[0] === "fn");
  return fn?.[3] || "";
}

function setDomainStatus(message, status) {
  if (!domainStatus) return;
  domainStatus.textContent = message;
  domainStatus.dataset.status = status;
}

async function saveLead(stage, formData, extra = {}) {
  const payload = {
    stage,
    submitted_at: new Date().toISOString(),
    ...formDataToObject(formData),
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
  try {
    const existing = JSON.parse(localStorage.getItem("docked_leads") || "[]");
    existing.push(payload);
    localStorage.setItem("docked_leads", JSON.stringify(existing.slice(-40)));
  } catch {
    localStorage.setItem("docked_leads", JSON.stringify([payload]));
  }
}

function formDataToObject(formData) {
  const output = {};
  for (const [key, value] of formData.entries()) {
    if (value) output[key] = value;
  }
  return output;
}

function appendAgentMessage(text, type = "outgoing") {
  if (!agentChat) return;
  agentChat.insertAdjacentHTML("beforeend", `<div class="agent-message ${type}">${escapeHtml(text)}</div>`);
  agentChat.scrollTop = agentChat.scrollHeight;
}

function buildPreviewSvg(snapshot) {
  const [primary, accent, background] = snapshot.style.colors;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">
  <rect width="1200" height="760" fill="${background}"/>
  <rect x="70" y="60" width="1060" height="640" rx="26" fill="#ffffff" stroke="#d9e4e2" stroke-width="3"/>
  <rect x="70" y="60" width="1060" height="72" rx="26" fill="${primary}"/>
  <circle cx="115" cy="96" r="10" fill="${accent}"/>
  <circle cx="148" cy="96" r="10" fill="#ffffff" opacity=".68"/>
  <circle cx="181" cy="96" r="10" fill="#ffffff" opacity=".36"/>
  <text x="230" y="106" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#ffffff">${escapeSvg(snapshot.domain)}</text>
  <text x="115" y="230" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="${accent}">${escapeSvg(snapshot.kicker)}</text>
  <text x="115" y="315" font-family="Arial, sans-serif" font-size="64" font-weight="800" fill="${primary}">${escapeSvg(snapshot.headline)}</text>
  <foreignObject x="115" y="350" width="620" height="130"><p xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;font-size:28px;line-height:1.45;color:#46595c;margin:0;">${escapeHtml(snapshot.subcopy)}</p></foreignObject>
  <rect x="115" y="525" width="210" height="64" rx="12" fill="${primary}"/>
  <text x="158" y="568" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#ffffff">Start now</text>
  <rect x="790" y="220" width="230" height="230" rx="34" fill="${primary}"/>
  <text x="856" y="362" font-family="Arial, sans-serif" font-size="96" font-weight="800" fill="#ffffff">${escapeSvg(initials(snapshot.business))}</text>
  ${snapshot.services
    .slice(0, 4)
    .map((service, index) => `<rect x="${115 + index * 245}" y="620" width="210" height="44" rx="12" fill="#eef7f3"/><text x="${140 + index * 245}" y="650" font-family="Arial, sans-serif" font-size="20" fill="#203538">${escapeSvg(service)}</text>`)
    .join("")}
</svg>`;
}

function downloadTextFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalizeDomain(value) {
  const raw = cleanValue(value)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/[^a-z0-9.-]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\./, "")
    .replace(/\.$/, "");

  if (!raw) return "";
  return raw.includes(".") ? raw : `${raw}.com.au`;
}

function cleanValue(value) {
  return String(value || "").trim();
}

function initials(value) {
  const letters = cleanValue(value)
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return letters || "D";
}

function addService(services, service) {
  return [service, ...services.filter((item) => item !== service)].slice(0, 5);
}

function slugify(value) {
  return cleanValue(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "docked-preview";
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

function escapeSvg(value) {
  return escapeHtml(value);
}

function renderPaypalButton() {
  const container = document.querySelector("#paypal-container-ZGTCFXXGBGNKU");
  if (!container || container.childElementCount || !window.paypal?.HostedButtons) return;
  paypal.HostedButtons({
    hostedButtonId: "ZGTCFXXGBGNKU",
  }).render("#paypal-container-ZGTCFXXGBGNKU");
}

renderPaypalButton();
window.addEventListener("load", renderPaypalButton);
