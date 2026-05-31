const SHEET_WEBHOOK_URL = "";

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

const preview = readPreview() || createFallbackPreview();
const customerSite = document.querySelector("#customerSite");
const statusText = document.querySelector("#previewStatus");
const revisionForm = document.querySelector("#revisionForm");
const revisionInput = document.querySelector("#revisionInput");
const agentLog = document.querySelector("#agentLog");
const shuffleButton = document.querySelector("#shuffleButton");
const focusButton = document.querySelector("#focusButton");
const approveButton = document.querySelector("#approveButton");

renderPreview(preview);
persistPreview(preview);

revisionForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const request = revisionInput.value.trim();
  if (!request) return;
  appendMessage(request, "incoming");
  applyRevision(preview, request);
  renderPreview(preview);
  persistPreview(preview);
  appendMessage(`Updated the preview: ${summariseRevision(request)}.`);
  revisionInput.value = "";
  saveLead("preview_revision", { revision_request: request, preview_snapshot: JSON.stringify(preview) });
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    revisionInput.value = button.dataset.prompt;
    revisionForm.requestSubmit();
  });
});

shuffleButton?.addEventListener("click", () => {
  const names = Object.keys(palettes);
  const current = names.indexOf(preview.style?.name || "Premium");
  preview.style = palettes[names[(current + 1) % names.length]];
  preview.revisions.push({ request: "Shuffle design", changed_at: new Date().toISOString() });
  renderPreview(preview);
  persistPreview(preview);
  appendMessage(`Switched to the ${preview.style.name.toLowerCase()} design direction.`);
});

focusButton?.addEventListener("click", () => {
  document.body.classList.toggle("focus-mode");
  focusButton.textContent = document.body.classList.contains("focus-mode") ? "Show agent" : "Focus view";
});

approveButton?.addEventListener("click", async () => {
  localStorage.setItem("docked_preview_approved", "true");
  await saveLead("preview_approved", { preview_snapshot: JSON.stringify(preview) });
  window.location.href = "index.html#approve";
});

function renderPreview(data) {
  const [brand, accent, soft, paper] = data.style.colors;
  customerSite.style.setProperty("--brand", brand);
  customerSite.style.setProperty("--accent", accent);
  customerSite.style.setProperty("--soft", soft);
  customerSite.style.setProperty("--site-paper", paper);
  customerSite.className = `customer-site layout-${data.style.layout}`;

  setText("#siteBusiness", data.business);
  setText("#brandMark", initials(data.business));
  setText("#siteKicker", `${data.industry} / ${data.style.name} direction`);
  setText("#siteHeadline", data.headline);
  setText("#siteSubcopy", data.subcopy);
  setText("#navCta", data.cta);
  setText("#heroCta", data.cta);
  setText("#contactCta", data.cta);
  setText("#visualWord", visualWord(data));
  setText("#visualMetric", metricForGoal(data.goal));
  setText("#visualInitials", initials(data.business));
  setText("#siteQuote", quoteFor(data));
  setText("#quoteName", `${data.business} launch preview`);
  setText("#quoteRole", `${data.style.tone} website system`);
  setText("#contactBusiness", data.business);
  setText("#contactDomain", data.domain);
  setText("#contactHeadline", `Launch ${data.business} with a site customers can trust.`);
  setText("#contactCopy", `Docked can turn this approved direction into a live site on ${data.domain}, then keep it active for $30/month.`);
  if (statusText) statusText.textContent = `${data.business} / ${data.domain}`;

  renderStats(data);
  renderServices(data);
  renderProof(data);
}

function renderStats(data) {
  const stats = [
    ["$30", "monthly launch plan"],
    [data.domain ? "Domain" : "Ready", data.domain || "included path"],
    [data.features?.length || data.services.length, "planned features"],
  ];
  document.querySelector("#siteStats").innerHTML = stats
    .map(([value, label]) => `<div><dt>${escapeHtml(value)}</dt><dd>${escapeHtml(label)}</dd></div>`)
    .join("");
}

function renderServices(data) {
  document.querySelector("#serviceGrid").innerHTML = data.services
    .slice(0, 6)
    .map((service, index) => {
      const title = escapeHtml(service);
      const copy = serviceCopy(service, data);
      return `<article class="service-card"><span>${String(index + 1).padStart(2, "0")}</span><h4>${title}</h4><p>${escapeHtml(copy)}</p></article>`;
    })
    .join("");
}

function renderProof(data) {
  document.querySelector("#proofList").innerHTML = data.trust
    .map((item) => `<div><strong>${escapeHtml(item)}</strong><p>${escapeHtml(proofCopy(item, data))}</p></div>`)
    .join("");
}

function applyRevision(data, request) {
  const lower = request.toLowerCase();
  data.revisions.push({ request, changed_at: new Date().toISOString() });

  if (/premium|luxury|trust|credible/.test(lower)) data.style = palettes.Premium;
  if (/bold|loud|stand out|strong/.test(lower)) data.style = palettes.Bold;
  if (/minimal|clean|simple|calm/.test(lower)) data.style = palettes.Minimal;
  if (/warm|friendly|human|soft/.test(lower)) data.style = palettes.Warm;

  if (/booking|book/.test(lower)) addFeature(data, "Booking");
  if (/quote|lead|enquiry|enquiries/.test(lower)) addFeature(data, "Quote form");
  if (/review|testimonial|proof/.test(lower)) addFeature(data, "Reviews");
  if (/gallery|image|photo|portfolio/.test(lower)) addFeature(data, "Gallery");
  if (/shop|sell|product/.test(lower)) addFeature(data, "Shop");
  if (/logo|brand/.test(lower)) addFeature(data, "Logo concepts");

  if (/direct|clear|simple/.test(lower)) data.headline = `${data.business}, made easy to choose`;
  if (/premium|luxury/.test(lower)) data.headline = `A sharper first impression for ${data.business}`;
  if (/booking|book/.test(lower)) data.headline = `${data.business} bookings, made effortless`;
  if (/bold|stand out/.test(lower)) data.headline = `${data.business} is ready to be noticed`;

  data.subcopy = `${data.business} gets a ${data.style.tone} website direction built around ${data.target_customer || "the right customers"}, with ${data.services.slice(0, 3).join(", ").toLowerCase()} ready for launch.`;
}

function addFeature(data, feature) {
  if (!data.features.includes(feature)) data.features.unshift(feature);
  if (!data.services.includes(feature)) data.services.unshift(feature);
  data.services = data.services.slice(0, 6);
}

function summariseRevision(request) {
  const lower = request.toLowerCase();
  const parts = [];
  if (/premium|luxury|trust|credible/.test(lower)) parts.push("premium styling");
  if (/bold|strong|stand out/.test(lower)) parts.push("stronger visual impact");
  if (/booking|book/.test(lower)) parts.push("booking path");
  if (/quote|lead|enquiry/.test(lower)) parts.push("lead capture");
  if (/review|testimonial|proof/.test(lower)) parts.push("proof section");
  if (/gallery|image|photo/.test(lower)) parts.push("visual gallery");
  return parts.length ? parts.join(", ") : "layout and content direction";
}

function serviceCopy(service, data) {
  const copy = {
    Booking: "A clear action path for customers who are ready to lock in a time.",
    "Quote form": "A low-friction enquiry flow so leads can ask for pricing quickly.",
    Gallery: "A visual proof section for showing finished work, products or atmosphere.",
    Shop: "A product-led section designed to move visitors toward purchase.",
    Reviews: "Credibility blocks that make the business feel established from day one.",
    "Logo concepts": "A flexible identity direction with colours and simple usage rules.",
    Services: "A scannable service structure that explains the offer quickly.",
    "Fast enquiry": "A conversion path built for mobile customers who want a quick response.",
    Treatments: "A calm structure for explaining outcomes, services and next steps.",
    "Patient trust": "Proof-led content designed for care, reassurance and clarity.",
    Menu: "A polished menu presentation for mobile customers and local search.",
    Reservations: "A booking-led section that makes the next step obvious.",
    "Expert positioning": "A stronger expert-led narrative for professional credibility.",
    "Discovery calls": "A call booking path for qualified customer conversations.",
    "Product showcase": "A launch-ready product grid with concise selling points.",
    "Checkout path": "A simple purchase journey that can connect to payment later.",
  };
  return copy[service] || `${service} shaped around ${data.goal.toLowerCase()} and ${data.target_customer || "the intended audience"}.`;
}

function proofCopy(item, data) {
  if (/mobile/i.test(item)) return "Designed to feel strong on phone screens first, where most early customers will see it.";
  if (/seo|search/i.test(item)) return "The structure gives Docked a clean starting point for search-friendly page content.";
  if (/trust|proof|premium/i.test(item)) return "The layout leads with credibility, clarity and a professional first impression.";
  return `Supports ${data.goal.toLowerCase()} without adding unnecessary complexity.`;
}

function quoteFor(data) {
  return `${data.business} should feel established before a customer ever calls. This preview gives the final build a premium direction to work from.`;
}

function visualWord(data) {
  if (/booking/i.test(data.goal)) return "Booked";
  if (/sell|shop/i.test(data.goal)) return "Sold";
  if (/waitlist/i.test(data.goal)) return "Launch";
  if (/showcase/i.test(data.goal)) return "Seen";
  return "Trusted";
}

function metricForGoal(goal) {
  if (/booking/i.test(goal)) return "3-step";
  if (/sell/i.test(goal)) return "Shop";
  if (/waitlist/i.test(goal)) return "Lead";
  return "24h";
}

function createFallbackPreview() {
  return {
    business: "Docked demo build",
    email: "",
    industry: "Startup or SaaS",
    goal: "Look credible for launch",
    project_type: "Website + logo",
    target_customer: "founders who need a polished launch quickly",
    domain: "demo-preview.com.au",
    features: ["Quote form", "Reviews", "Logo concepts"],
    services: ["Quote form", "Reviews", "Logo concepts", "Homepage", "About", "Contact"],
    headline: "Launch with a site customers trust",
    subcopy: "A premium preview direction for a new business that needs to look credible fast.",
    style: palettes.Premium,
    cta: "Enquire now",
    trust: ["Premium first impression", "Conversion-led sections", "Mobile-ready structure"],
    generated_at: new Date().toISOString(),
    revisions: [],
  };
}

async function saveLead(stage, extra = {}) {
  const payload = {
    stage,
    submitted_at: new Date().toISOString(),
    ...extra,
  };

  const existing = JSON.parse(localStorage.getItem("docked_leads") || "[]");
  existing.push(payload);
  localStorage.setItem("docked_leads", JSON.stringify(existing.slice(-50)));

  if (!SHEET_WEBHOOK_URL) return { sent: false, local: true };

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

function readPreview() {
  try {
    return JSON.parse(localStorage.getItem("docked_preview") || "null");
  } catch {
    return null;
  }
}

function persistPreview(data) {
  localStorage.setItem("docked_preview", JSON.stringify(data));
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value || "";
}

function appendMessage(text, type = "outgoing") {
  agentLog.insertAdjacentHTML("beforeend", `<div class="agent-message ${type}">${escapeHtml(text)}</div>`);
  agentLog.scrollTop = agentLog.scrollHeight;
}

function initials(value) {
  const letters = String(value || "")
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return letters || "D";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
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
