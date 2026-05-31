const SHEET_WEBHOOK_URL = "";

const taskSets = {
  logo: ["Analyse brand cues", "Generate logo routes", "Prepare colour variants", "Package export files"],
  booking: ["Map booking action", "Add homepage CTA", "Connect booking destination", "Publish after approval"],
  price: ["Find pricing mentions", "Update offer copy", "Check mobile layout", "Publish after approval"],
  domain: ["Check domain options", "Prepare registration task", "Connect DNS records", "Confirm launch path"],
  default: ["Interpret request", "Generate draft", "Send preview", "Publish after approval"],
};

const palettes = {
  Premium: {
    name: "Premium",
    layout: "noir",
    colors: ["#071f23", "#c9a45c", "#f5efe6", "#ffffff"],
    tone: "polished, confident and high-trust",
  },
  Bold: {
    name: "Bold",
    layout: "electric",
    colors: ["#1338f2", "#ff5c35", "#fff6e8", "#111827"],
    tone: "energetic, memorable and conversion-led",
  },
  Minimal: {
    name: "Minimal",
    layout: "atelier",
    colors: ["#151515", "#9ca3af", "#f8fafc", "#ffffff"],
    tone: "clean, precise and premium",
  },
  Warm: {
    name: "Warm",
    layout: "sunlit",
    colors: ["#164e63", "#e76f51", "#fff7ed", "#ffffff"],
    tone: "approachable, human and polished",
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
const approvalForm = document.querySelector("#approvalForm");
const approvalStatus = document.querySelector("#approvalStatus");

let rdapBootstrap = null;

automationForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const request = requestText.value.trim();
  if (!request) return;

  const tasks = pickTasks(request);
  chatLog.insertAdjacentHTML("beforeend", `<div class="message incoming">${escapeHtml(request)}</div>`);
  chatLog.insertAdjacentHTML("beforeend", `<div class="message outgoing">Queued: ${tasks.join(", ").toLowerCase()}.</div>`);
  taskList.innerHTML = tasks.map((task) => `<li><span></span> ${task}</li>`).join("");
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

  const preview = createPreview(formData);
  localStorage.setItem("docked_preview", JSON.stringify(preview));
  localStorage.removeItem("docked_preview_approved");
  await saveLead("preview_created", formData, { preview_snapshot: JSON.stringify(preview) });

  formStatus.textContent = "Creating full preview...";
  window.location.href = "preview.html";
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

approvalForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!approvalForm.reportValidity()) return;

  const preview = readPreview();
  const formData = new FormData(approvalForm);
  if (preview) {
    formData.set("approved_preview_snapshot", JSON.stringify(preview));
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

hydrateApprovalFromPreview();
renderPaypalButton();
window.addEventListener("load", renderPaypalButton);

function hydrateApprovalFromPreview() {
  if (!approvalForm) return;
  const preview = readPreview();
  const approved = localStorage.getItem("docked_preview_approved") === "true";
  if (!preview || !approved) return;

  approvalForm.elements.approved_business.value = preview.business || "";
  approvalForm.elements.approved_email.value = preview.email || "";
  approvalForm.elements.approved_domain.value = preview.domain || "";
  approvalForm.elements.preview_link.value = `Generated Docked preview - ${new Date(preview.generated_at).toLocaleString("en-AU")}`;
  const snapshotField = document.querySelector("#approvedPreviewSnapshotField");
  if (snapshotField) snapshotField.value = JSON.stringify(preview);
  approvalStatus.textContent = "Preview accepted. Complete the approval details and PayPal payment below.";
}

function createPreview(formData) {
  const business = cleanValue(formData.get("business")) || "Your business";
  const industry = cleanValue(formData.get("industry")) || "Local business";
  const goal = cleanValue(formData.get("primary_goal")) || "Get more enquiries";
  const styleName = cleanValue(formData.get("style_direction")) || "Premium";
  const style = palettes[styleName] || palettes.Premium;
  const features = formData.getAll("features").map(cleanValue).filter(Boolean);
  const details = cleanValue(formData.get("details"));
  const audience = cleanValue(formData.get("target_customer"));
  const domain = normalizeDomain(formData.get("preferred_domain")) || `${slugify(business)}.com.au`;

  const services = buildServices(industry, goal, features, details);
  const headline = buildHeadline(business, industry, goal, details);
  const subcopy = buildSubcopy(business, audience, goal, style);

  return {
    business,
    email: cleanValue(formData.get("email")),
    phone: cleanValue(formData.get("phone")),
    industry,
    goal,
    project_type: cleanValue(formData.get("projectType")) || "Website",
    target_customer: audience,
    domain,
    current_website: cleanValue(formData.get("current_website")),
    details,
    preview_requirements: cleanValue(formData.get("preview_requirements")),
    visual_references: cleanValue(formData.get("visual_references")),
    features,
    services,
    headline,
    subcopy,
    style,
    cta: goalToCta(goal),
    trust: buildTrust(industry),
    generated_at: new Date().toISOString(),
    revisions: [],
  };
}

function buildHeadline(business, industry, goal, details) {
  const text = `${industry} ${goal} ${details}`.toLowerCase();
  if (text.includes("booking")) return "Turn visits into booked jobs";
  if (text.includes("sell") || text.includes("shop")) return "A storefront ready for customers";
  if (text.includes("credible") || text.includes("launch")) return "Launch with a site customers trust";
  if (text.includes("portfolio") || text.includes("showcase")) return "Show the work. Win the next brief.";
  return `${business}, built to win better customers`;
}

function buildSubcopy(business, audience, goal, style) {
  const customer = audience || "the right customers";
  return `${business} gets a ${style.tone} website direction built around ${customer}, with a clear path to ${goal.toLowerCase()}.`;
}

function buildServices(industry, goal, features, details) {
  const text = `${industry} ${goal} ${details} ${features.join(" ")}`.toLowerCase();
  const services = [...features];
  if (text.includes("trade") || text.includes("service")) services.push("Services", "Fast enquiry");
  if (text.includes("clinic") || text.includes("health")) services.push("Treatments", "Patient trust");
  if (text.includes("restaurant") || text.includes("cafe") || text.includes("venue")) services.push("Menu", "Reservations");
  if (text.includes("consult")) services.push("Expert positioning", "Discovery calls");
  if (text.includes("shop") || text.includes("product") || text.includes("ecommerce")) services.push("Product showcase", "Checkout path");
  services.push("Homepage", "About", "Contact");
  return [...new Set(services)].slice(0, 6);
}

function buildTrust(industry) {
  if (/health|clinic|wellness/i.test(industry)) return ["Patient-first copy", "Trust-building proof", "Simple bookings"];
  if (/restaurant|cafe|venue/i.test(industry)) return ["Menu-ready layout", "Mobile booking", "Local search focus"];
  if (/product|ecommerce/i.test(industry)) return ["Product storytelling", "Checkout path", "Launch-ready SEO"];
  return ["Premium first impression", "Conversion-led sections", "Mobile-ready structure"];
}

function goalToCta(goal) {
  if (/booking/i.test(goal)) return "Book now";
  if (/sell/i.test(goal)) return "Shop now";
  if (/waitlist/i.test(goal)) return "Join the waitlist";
  if (/showcase/i.test(goal)) return "View work";
  return "Enquire now";
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
  const existing = JSON.parse(localStorage.getItem("docked_leads") || "[]");
  existing.push(payload);
  localStorage.setItem("docked_leads", JSON.stringify(existing.slice(-50)));
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

function readPreview() {
  try {
    return JSON.parse(localStorage.getItem("docked_preview") || "null");
  } catch {
    return null;
  }
}

function pickTasks(value) {
  const lower = value.toLowerCase();
  if (lower.includes("logo") || lower.includes("brand")) return taskSets.logo;
  if (lower.includes("book") || lower.includes("call") || lower.includes("appointment")) return taskSets.booking;
  if (lower.includes("price") || lower.includes("$") || lower.includes("cost")) return taskSets.price;
  if (lower.includes("domain") || lower.includes(".com")) return taskSets.domain;
  return taskSets.default;
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

function renderPaypalButton() {
  const container = document.querySelector("#paypal-container-ZGTCFXXGBGNKU");
  if (!container || container.childElementCount || !window.paypal?.HostedButtons) return;
  paypal.HostedButtons({
    hostedButtonId: "ZGTCFXXGBGNKU",
  }).render("#paypal-container-ZGTCFXXGBGNKU");
}
