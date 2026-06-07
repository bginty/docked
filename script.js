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
          color: #b8e1c8;
          font-weight: 850;
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
          width: 112px;
          height: 68px;
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
        }
      `;
      document.head.appendChild(style);
    }

    document.title = "Docked | Know your limit before you borrow";

    const heroTitle = document.querySelector("#hero-title");
    if (heroTitle) heroTitle.innerHTML = "Know your <em>limit</em> before you borrow.";
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
            <img class="footer-logo-img" src="docked-logo.svg" alt="Docked" />
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
      "Docked helps Australian borrowers estimate repayments, borrowing power, LVR, LMI, refinance savings, HECS impact, bank statement affordability, and loan next steps before they borrow.";

    setMeta("description", description);
    setMeta("keywords", "home loan calculator Australia, borrowing power calculator, mortgage repayment calculator, LMI calculator, LVR calculator, refinance calculator, HECS borrowing power, first home buyer loans, guarantor loan Australia, stamp duty guide");
    setMetaProperty("og:title", "Docked | Know your limit before you borrow");
    setMetaProperty("og:description", description);
    setMetaProperty("og:type", "website");
    setMetaProperty("og:url", origin + "/");
    setMetaProperty("og:image", origin + "/docked-logo.svg");
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", "Docked | Know your limit before you borrow");
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
})();
