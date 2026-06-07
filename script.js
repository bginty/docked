(() => {
  const fullAppScriptSrc = "https://cdn.jsdelivr.net/gh/bginty/docked@42bb4974b0cf6386301c1240b90ad923ec4dd308/script.js";
  const pdfJsUrl = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
  const pdfJsWorkerUrl = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

  const patchPdfReaderWorker = () => {
    let dockedPdfJsPromise = null;

    window.loadPdfJs = async function loadPdfJs() {
      if (!dockedPdfJsPromise) {
        dockedPdfJsPromise = import(pdfJsUrl).then((pdfjs) => {
          pdfjs.GlobalWorkerOptions.workerSrc = pdfJsWorkerUrl;
          return pdfjs;
        });
      }
      return dockedPdfJsPromise;
    };
  };

  const appScript = document.createElement("script");
  appScript.src = fullAppScriptSrc;
  appScript.onload = () => {
    patchPdfReaderWorker();
    patchHomepageContent();
    patchHeroLeadPanel();
    patchLeadResponseTime();
    injectSeoTags();
  };
  appScript.onerror = () => {
    const formStatus = document.querySelector("#formStatus");
    if (formStatus) formStatus.textContent = "The calculator tools are taking a moment to load. Please refresh and try again.";
  };
  document.head.appendChild(appScript);

  function patchHomepageContent() {
    if (!document.querySelector("#dockedContentPatchStyles")) {
      const style = document.createElement("style");
      style.id = "dockedContentPatchStyles";
      style.textContent = `
        .footer-links {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 12px;
        }
        .footer-links a {
          color: #bfdbfe;
          font-weight: 850;
        }
        .site-footer {
          flex-wrap: wrap;
        }
        .site-footer a {
          overflow-wrap: anywhere;
          word-break: break-word;
          color: #bfdbfe;
        }
        .site-footer p {
          color: #c8d7ee;
        }
        .tool-hero {
          align-items: start;
        }
        .disclosure-box p + p {
          margin-top: 10px;
        }
        .brand.has-image-logo {
          min-width: 166px;
        }
        .site-logo-img {
          display: block;
          width: 158px;
          height: 44px;
          object-fit: contain;
        }
        .footer-brand-row {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 10px;
        }
        .footer-logo-img {
          width: 40px;
          height: 40px;
          object-fit: contain;
        }
        @media (max-width: 620px) {
          .brand.has-image-logo {
            min-width: 148px;
          }
          .site-logo-img {
            width: 142px;
            height: 42px;
          }
          .site-footer {
            display: grid;
            grid-template-columns: 1fr;
            align-items: start;
            gap: 18px;
            padding-right: 18px;
            padding-left: 18px;
          }
          .footer-brand-row {
            align-items: flex-start;
          }
          .footer-logo-img {
            width: 36px;
            height: 36px;
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.title = "Docked | Know before you apply";

    const heroTitle = document.querySelector("#hero-title");
    if (heroTitle) heroTitle.innerHTML = "Know <em>before</em> you apply.";
    setLink("icon", "docked-icon.svg");

    const brand = document.querySelector(".site-header .brand");
    if (brand) {
      brand.classList.add("has-image-logo");
      brand.innerHTML = '<img class="site-logo-img" src="docked-logo.svg" alt="Docked" />';
    }

    const nav = document.querySelector(".nav-links");
    if (nav && !nav.querySelector('a[href="about.html"]')) {
      const aboutLink = document.createElement("a");
      aboutLink.href = "about.html";
      aboutLink.textContent = "About";
      nav.appendChild(aboutLink);
    }
    const faqNavLink = nav?.querySelector('a[href="#faq"]');
    if (faqNavLink) faqNavLink.href = "faq.html";

    const disclosureBox = document.querySelector(".disclosure-box");
    if (disclosureBox) {
      disclosureBox.innerHTML = `
        <strong>ASIC referral disclosure</strong>
        <p>Docked is operated by Ginty United Investments Pty Ltd (ABN 78 606 187 106, ACN 606 187 106) as an online loan information and referral service. Docked is not a lender, credit provider, mortgage broker, credit representative, or holder of an Australian credit licence.</p>
        <p>Docked provides calculators, education, and enquiry routing only. We do not recommend a specific loan, lender, broker, product, or strategy, and we do not assess whether credit is suitable for you.</p>
        <p>If you ask for help and give consent, Docked may share your enquiry and affordability summary with a licensed broker, lender, aggregator, or authorised credit representative. Docked may receive a referral fee, affiliate commission, or other benefit if your details are referred or if you proceed with a provider.</p>
      `;
    }

    const brokerConsent = document.querySelector('input[name="consent_broker_contact"]')?.closest(".consent-line")?.querySelector("span");
    if (brokerConsent) {
      brokerConsent.textContent =
        "I agree Docked may share my details, calculator result, and affordability summary with a licensed broker, lender, aggregator, or authorised credit representative who may contact me about my enquiry.";
    }

    const referralConsent = document.querySelector('input[name="referral_fee_disclosure"]')?.closest(".consent-line")?.querySelector("span");
    if (referralConsent) {
      referralConsent.textContent =
        "I understand Docked may receive a referral fee, affiliate commission, or similar benefit if my details are referred or if I proceed with a provider.";
    }

    const privacyNote = document.querySelector(".privacy-note p");
    if (privacyNote) {
      privacyNote.textContent =
        "Docked collects your contact and loan details to respond to this enquiry, keep a record, and connect you with a licensed broker, lender, aggregator, or authorised credit representative if you consent. If you do not provide contact details, a callback cannot be arranged.";
    }

    const footer = document.querySelector(".site-footer");
    if (footer) {
      footer.innerHTML = `
        <div>
          <div class="footer-brand-row">
            <img class="footer-logo-img" src="docked-icon.svg" alt="Docked" />
            <strong>docked.com.au</strong>
          </div>
          <p>Australian loan calculators, borrower education, affordability checks, and loan help.</p>
          <p>Operated by Ginty United Investments Pty Ltd. ABN 78 606 187 106. ACN 606 187 106.</p>
          <nav class="footer-links" aria-label="Footer links">
            <a href="about.html">About us</a>
            <a href="faq.html">FAQ</a>
            <a href="privacy.html">Privacy policy</a>
            <a href="terms.html">Terms of use</a>
          </nav>
        </div>
        <a href="mailto:hello@docked.com.au">hello@docked.com.au</a>
      `;
    }
  }

  function patchHeroLeadPanel() {
    const panel = document.querySelector(".insight-panel");
    if (!panel || panel.dataset.quickCaptureReady === "true") return;

    panel.dataset.quickCaptureReady = "true";
    panel.classList.add("quick-capture-panel");

    if (!document.querySelector("#dockedHeroLeadStyles")) {
      const style = document.createElement("style");
      style.id = "dockedHeroLeadStyles";
      style.textContent = `
        .quick-capture-panel {
          width: min(560px, 100%);
        }
        .quick-adjust-grid,
        .quick-lead-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .quick-lead-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-top: 12px;
        }
        .quick-adjust-field,
        .quick-lead-form label {
          display: grid;
          gap: 6px;
          color: #9fb3cf;
          font-size: 0.74rem;
          font-weight: 900;
        }
        .quick-adjust-field input,
        .quick-lead-form input,
        .quick-lead-form select {
          width: 100%;
          min-height: 40px;
          padding: 0 10px;
          background: rgba(255, 255, 255, 0.11);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 10px;
          color: #ffffff;
          font-weight: 900;
          outline: none;
        }
        .quick-lead-form select option {
          color: #071427;
        }
        .quick-form-title {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 12px;
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.13);
        }
        .quick-form-title strong {
          color: #ffffff;
          font-size: 1rem;
        }
        .quick-form-title span,
        .quick-capture-panel p,
        .quick-status {
          color: #b8c8df;
        }
        .quick-consent {
          grid-template-columns: auto minmax(0, 1fr);
          align-items: start;
          margin: 12px 0;
          color: #c7d6ea !important;
          font-size: 0.78rem !important;
          line-height: 1.45;
        }
        .quick-consent input {
          width: 18px;
          min-height: 18px;
          margin-top: 2px;
          padding: 0;
        }
        .quick-status {
          min-height: 20px;
          margin: 10px 0 0;
          font-size: 0.85rem;
          font-weight: 800;
        }
        .quick-capture-panel .visual-card {
          height: 108px;
          margin: 12px 0;
        }
        @media (max-width: 620px) {
          .quick-adjust-grid,
          .quick-lead-grid {
            grid-template-columns: 1fr;
          }
          .quick-form-title {
            display: grid;
          }
        }
      `;
      document.head.appendChild(style);
    }

    panel.innerHTML = `
      <div class="panel-top">
        <span>Monthly repayment</span>
        <strong id="heroRepayment">$3,690</strong>
        <em>Guide</em>
      </div>
      <div class="quick-adjust-grid" aria-label="Adjust repayment guide">
        <label class="quick-adjust-field">Loan amount <input id="heroLoanAmount" type="number" min="10000" step="1000" value="600000" /></label>
        <label class="quick-adjust-field">Rate <input id="heroLoanRate" type="number" min="0" step="0.01" value="6.24" /></label>
        <label class="quick-adjust-field">Term <input id="heroLoanTerm" type="number" min="1" max="40" step="1" value="30" /></label>
      </div>
      <div class="visual-card" aria-hidden="true">
        <div class="bar one"></div>
        <div class="bar two"></div>
        <div class="bar three"></div>
        <div class="bar four"></div>
      </div>
      <p>
        Adjust the guide, then submit your details for a quick loan help response.
      </p>
      <form class="quick-lead-form" id="heroQuickLeadForm">
        <div class="quick-form-title">
          <strong>Submit your details</strong>
          <span>Response within 1 business day.</span>
        </div>
        <div class="quick-lead-grid">
          <label>Name <input name="name" type="text" autocomplete="name" required /></label>
          <label>Phone <input name="phone" type="tel" autocomplete="tel" required /></label>
          <label>Email <input name="email" type="email" autocomplete="email" required /></label>
          <label>Postcode <input name="postcode" type="text" inputmode="numeric" maxlength="4" /></label>
          <label>
            Purpose
            <select name="loan_purpose" required>
              <option>First home buyer</option>
              <option>Refinance</option>
              <option>Investment property</option>
              <option>Next home purchase</option>
              <option>Car or personal loan</option>
              <option>Business finance</option>
            </select>
          </label>
          <label>
            Timeframe
            <select name="timeframe" required>
              <option>Ready now</option>
              <option>Within 30 days</option>
              <option>1 to 3 months</option>
              <option>3 to 6 months</option>
              <option>Just researching</option>
            </select>
          </label>
        </div>
        <label class="quick-consent">
          <input name="quick_consent" type="checkbox" required />
          <span>I agree Docked may share my details with a licensed broker, lender, aggregator, or authorised credit representative and may receive a referral fee.</span>
        </label>
        <button class="button primary wide" type="submit">Submit details</button>
        <p class="quick-status" id="heroQuickLeadStatus" role="status"></p>
      </form>
    `;

    const quickForm = panel.querySelector("#heroQuickLeadForm");
    const amountInput = panel.querySelector("#heroLoanAmount");
    const rateInput = panel.querySelector("#heroLoanRate");
    const termInput = panel.querySelector("#heroLoanTerm");
    const repaymentTarget = panel.querySelector("#heroRepayment");
    const quickStatus = panel.querySelector("#heroQuickLeadStatus");

    const readHeroScenario = () => {
      const loan = Number(amountInput?.value || 0);
      const rate = Number(rateInput?.value || 0);
      const years = Number(termInput?.value || 0);
      const repayment = calculateMonthlyRepayment(loan, rate, years);
      return { loan, rate, years, repayment };
    };

    const updateHeroGuide = () => {
      const scenario = readHeroScenario();
      if (repaymentTarget) repaymentTarget.textContent = formatCurrency(scenario.repayment);
      syncMainRepaymentForm(scenario);
    };

    [amountInput, rateInput, termInput].forEach((input) => {
      input?.addEventListener("input", updateHeroGuide);
      input?.addEventListener("change", updateHeroGuide);
    });

    quickForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!quickForm.reportValidity()) return;

      const leadForm = document.querySelector("#leadForm");
      if (!leadForm) {
        if (quickStatus) quickStatus.textContent = "Please use the full help form below.";
        return;
      }

      const scenario = readHeroScenario();
      const formData = new FormData(quickForm);
      const snapshot = {
        calculator: "hero_quick_repayment",
        title: "Monthly repayment guide",
        primary: formatCurrency(scenario.repayment),
        detail: `Quick guide based on ${formatCurrency(scenario.loan)} at ${formatPercent(scenario.rate)}% over ${Math.round(scenario.years || 0)} years.`,
        values: {
          loan_amount: scenario.loan,
          interest_rate: scenario.rate,
          loan_term_years: scenario.years,
          repayment_frequency: "monthly",
          repayment: Math.round(scenario.repayment * 100) / 100,
        },
        calculated_at: new Date().toISOString(),
      };

      setLeadValue(leadForm, "stage", "quick_loan_help_requested");
      setLeadValue(leadForm, "lead_source", "docked.com.au hero quick capture");
      setLeadValue(leadForm, "loan_purpose", formData.get("loan_purpose"));
      setLeadValue(leadForm, "timeframe", formData.get("timeframe"));
      setLeadValue(leadForm, "loan_amount", scenario.loan);
      setLeadValue(leadForm, "name", formData.get("name"));
      setLeadValue(leadForm, "phone", formData.get("phone"));
      setLeadValue(leadForm, "email", formData.get("email"));
      setLeadValue(leadForm, "postcode", formData.get("postcode"));
      setLeadValue(leadForm, "calculator_snapshot", JSON.stringify(snapshot));
      setLeadValue(
        leadForm,
        "notes",
        `Hero quick capture: ${formatCurrency(scenario.loan)} loan guide, ${formatPercent(scenario.rate)}% rate, ${Math.round(scenario.years || 0)} year term, estimated repayment ${formatCurrency(scenario.repayment)} per month.`,
      );
      setLeadValue(leadForm, "consent_broker_contact", true);
      setLeadValue(leadForm, "referral_fee_disclosure", true);

      if (quickStatus) quickStatus.textContent = "Sending your details...";
      if (typeof leadForm.requestSubmit === "function") {
        leadForm.requestSubmit();
      } else {
        leadForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }

      window.setTimeout(() => {
        if (quickStatus) quickStatus.textContent = "Thanks, your details have been received. Expect a response within 1 business day.";
      }, 950);
    });

    updateHeroGuide();
  }

  function patchLeadResponseTime() {
    const leadForm = document.querySelector("#leadForm");
    const formStatus = document.querySelector("#formStatus");
    if (!leadForm || !formStatus || leadForm.dataset.responseTimePatched === "true") return;

    leadForm.dataset.responseTimePatched = "true";
    leadForm.addEventListener("submit", () => {
      if (!leadForm.checkValidity()) return;
      window.setTimeout(() => {
        formStatus.textContent =
          "Thanks, your loan help request has been received. Expect a response within 1 business day.";
      }, 900);
    });
  }

  function injectSeoTags() {
    const origin = "https://docked.com.au";
    const description =
      "Docked helps Australian borrowers estimate repayments, borrowing power, LVR, LMI, refinance savings, HECS impact, bank statement affordability, and loan next steps before they apply.";

    setMeta("description", description);
    setMeta("keywords", "home loan calculator Australia, borrowing power calculator, mortgage repayment calculator, LMI calculator, LVR calculator, refinance calculator, HECS borrowing power, first home buyer loans, guarantor loan Australia, stamp duty guide");
    setMetaProperty("og:title", "Docked | Know before you apply");
    setMetaProperty("og:description", description);
    setMetaProperty("og:type", "website");
    setMetaProperty("og:url", origin + "/");
    setMetaProperty("og:image", origin + "/docked-logo.svg");
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", "Docked | Know before you apply");
    setMeta("twitter:description", description);
    setLink("canonical", origin + "/");

    addJsonLd("docked-org-schema", {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Docked",
      legalName: "Ginty United Investments Pty Ltd",
      url: origin + "/",
      logo: origin + "/docked-logo.svg",
      email: "hello@docked.com.au",
      identifier: [
        { "@type": "PropertyValue", name: "ABN", value: "78 606 187 106" },
        { "@type": "PropertyValue", name: "ACN", value: "606 187 106" },
      ],
    });

    addJsonLd("docked-website-schema", {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Docked",
      url: origin + "/",
      description,
      publisher: { "@type": "Organization", name: "Docked" },
    });
  }

  function setMeta(name, content) {
    let tag = document.querySelector(`meta[name="${name}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", name);
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", content);
  }

  function setMetaProperty(property, content) {
    let tag = document.querySelector(`meta[property="${property}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("property", property);
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", content);
  }

  function setLink(rel, href) {
    let tag = document.querySelector(`link[rel="${rel}"]`);
    if (!tag) {
      tag = document.createElement("link");
      tag.setAttribute("rel", rel);
      document.head.appendChild(tag);
    }
    tag.setAttribute("href", href);
  }

  function addJsonLd(id, data) {
    if (document.querySelector(`#${id}`)) return;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = id;
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  function calculateMonthlyRepayment(principal, annualRate, years) {
    const periods = Number(years || 0) * 12;
    const monthlyRate = Number(annualRate || 0) / 100 / 12;
    const loan = Number(principal || 0);
    if (!loan || !periods) return 0;
    if (!monthlyRate) return loan / periods;
    return loan * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -periods)));
  }

  function syncMainRepaymentForm(scenario) {
    const form = document.querySelector("#repaymentsCalc");
    if (!form) return;
    setLeadValue(form, "loan_amount", scenario.loan);
    setLeadValue(form, "interest_rate", scenario.rate);
    setLeadValue(form, "loan_term_years", scenario.years);
    setLeadValue(form, "repayment_frequency", "monthly");
    ["loan_amount", "interest_rate", "loan_term_years", "repayment_frequency"].forEach((name) => {
      form.elements[name]?.dispatchEvent(new Event("input", { bubbles: true }));
      form.elements[name]?.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  function setLeadValue(form, name, value) {
    const field = form?.elements?.[name] || document.querySelector(`#${name}`);
    if (!field || value === undefined || value === null) return;
    if (field.type === "checkbox") {
      field.checked = Boolean(value);
      return;
    }
    field.value = value;
  }

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    });
  }

  function formatCompactCurrency(value) {
    const amount = Number(value || 0);
    if (amount >= 1000000) return `$${(amount / 1000000).toLocaleString("en-AU", { maximumFractionDigits: 1 })}m`;
    if (amount >= 1000) return `$${Math.round(amount / 1000).toLocaleString("en-AU")}k`;
    return formatCurrency(amount);
  }

  function formatPercent(value) {
    return Number(value || 0).toLocaleString("en-AU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
})();
