(function () {
  "use strict";

  var product = window.DOCKED_PRODUCT;
  var analyticsReady = { ga4: false, meta: false };

  function nonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function appendScript(source, attributes) {
    var script = document.createElement("script");
    script.src = source;
    Object.keys(attributes || {}).forEach(function (name) {
      script.setAttribute(name, attributes[name]);
    });
    document.head.appendChild(script);
    return script;
  }

  function initAnalytics() {
    var analytics = product && product.analytics ? product.analytics : {};
    var ga4Id = nonEmptyString(analytics.ga4MeasurementId) ? analytics.ga4MeasurementId.trim() : "";
    var metaId = nonEmptyString(analytics.metaPixelId) ? analytics.metaPixelId.trim() : "";

    if (/^G-[A-Z0-9]+$/i.test(ga4Id)) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () {
        window.dataLayer.push(arguments);
      };
      window.gtag("js", new Date());
      window.gtag("config", ga4Id, { anonymize_ip: true });
      appendScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(ga4Id), {
        async: "",
        "data-docked-analytics": "ga4"
      });
      analyticsReady.ga4 = true;
    }

    if (/^\d{5,20}$/.test(metaId)) {
      if (!window.fbq) {
        var fbq = function () {
          fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
        };
        fbq.push = fbq;
        fbq.loaded = true;
        fbq.version = "2.0";
        fbq.queue = [];
        window.fbq = fbq;
        window._fbq = fbq;
      }
      window.fbq("init", metaId);
      window.fbq("track", "PageView");
      appendScript("https://connect.facebook.net/en_US/fbevents.js", {
        async: "",
        "data-docked-analytics": "meta"
      });
      analyticsReady.meta = true;
    }
  }

  function safeAnalyticsParameters(parameters) {
    var allowed = ["placement", "item_name", "currency", "value", "question", "view", "provider"];
    var safe = {};
    if (!parameters || typeof parameters !== "object") return safe;
    allowed.forEach(function (name) {
      var value = parameters[name];
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        safe[name] = value;
      }
    });
    return safe;
  }

  function trackEvent(name, parameters) {
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(name || "")) return;
    var safe = safeAnalyticsParameters(parameters);
    if (analyticsReady.ga4 && typeof window.gtag === "function") {
      window.gtag("event", name, safe);
    }
    if (analyticsReady.meta && typeof window.fbq === "function") {
      window.fbq("trackCustom", name, safe);
    }
  }

  window.dockedTrackEvent = trackEvent;
  initAnalytics();

  function visibleFaqItems() {
    return Array.from(document.querySelectorAll("[data-faq-list] details, .faq-list details"))
      .filter(function (details, index, items) {
        var style = window.getComputedStyle(details);
        return items.indexOf(details) === index && !details.hidden && !details.closest("[hidden]") &&
          style.display !== "none" && style.visibility !== "hidden";
      })
      .map(function (details) {
        var summary = details.querySelector("summary");
        var answerParts = Array.from(details.children).filter(function (child) {
          return child !== summary && !child.hidden;
        });
        return {
          question: summary ? summary.textContent.trim() : "",
          answer: answerParts.map(function (part) { return part.textContent.trim(); }).filter(Boolean).join(" ")
        };
      })
      .filter(function (item) { return item.question && item.answer; });
  }

  function injectStructuredData() {
    if (!product || !nonEmptyString(product.url)) return;
    var siteUrl = product.url;
    var organization = product.organization || {};
    var organizationId = siteUrl + "#organization";
    var websiteId = siteUrl + "#website";
    var graph = [];

    graph.push({
      "@type": "Organization",
      "@id": organizationId,
      name: organization.name || product.brand,
      legalName: organization.legalName,
      taxID: organization.taxId,
      url: organization.url || siteUrl,
      email: organization.email || product.supportEmail
    });
    graph.push({
      "@type": "WebSite",
      "@id": websiteId,
      name: product.brand,
      url: siteUrl,
      publisher: { "@id": organizationId }
    });

    var productPage = document.querySelector("[data-product-page], .hero");
    var price = Number(product.price);
    if (productPage && nonEmptyString(product.name) && nonEmptyString(product.description)) {
      var productNode = {
        "@type": "Product",
        "@id": siteUrl + "#product",
        name: product.name,
        brand: { "@type": "Brand", name: product.brand },
        description: product.description,
        url: siteUrl,
        image: Array.isArray(product.images) ? product.images.filter(nonEmptyString) : []
      };
      if (product.checkoutEnabled && Number.isFinite(price) && price > 0 && nonEmptyString(product.currency)) {
        productNode.offers = {
          "@type": "Offer",
          url: siteUrl + "#checkout",
          price: String(price),
          priceCurrency: product.currency
        };
      }
      graph.push(productNode);
    }

    var faqItems = visibleFaqItems();
    if (faqItems.length) {
      graph.push({
        "@type": "FAQPage",
        "@id": siteUrl + "#faq",
        mainEntity: faqItems.map(function (item) {
          return {
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer }
          };
        })
      });
    }

    var script = document.querySelector("script[data-docked-structured-data]");
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.dockedStructuredData = "true";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
  }

  injectStructuredData();

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(function (element) {
      element.textContent = value;
    });
  }

  if (product) {
    setText("[data-product-name]", product.name);
    setText("[data-product-subtitle]", product.subtitle);
    setText("[data-minimum-age]", String(product.minimumAge));

    var priceNumber = Number(product.price);
    if (Number.isFinite(priceNumber) && product.currency === "AUD") {
      var audAmount = new Intl.NumberFormat("en-AU", {
        maximumFractionDigits: 0,
        minimumFractionDigits: 0
      }).format(priceNumber);
      setText("[data-product-price]", "$" + audAmount);
    }

    document.querySelectorAll("[data-support-email]").forEach(function (link) {
      link.textContent = product.supportEmail;
      if (link.tagName === "A") {
        link.href = "mailto:" + product.supportEmail;
      }
    });

    var specificationsRoot = document.querySelector("[data-product-specifications]");
    var visibleSpecifications = Array.isArray(product.specifications)
      ? product.specifications.filter(function (specification) {
          return specification && specification.value !== null &&
            nonEmptyString(specification.label) && nonEmptyString(specification.value);
        })
      : [];
    if (specificationsRoot) {
      specificationsRoot.replaceChildren();
      visibleSpecifications.forEach(function (specification) {
        var row = document.createElement("div");
        var term = document.createElement("dt");
        var description = document.createElement("dd");
        row.className = "spec-row";
        row.dataset.specification = specification.key || "";
        term.textContent = specification.label;
        description.textContent = specification.value;
        row.append(term, description);
        specificationsRoot.appendChild(row);
      });
      specificationsRoot.hidden = visibleSpecifications.length === 0;
      var specificationsSection = specificationsRoot.closest("[data-specifications-section]");
      if (specificationsSection) specificationsSection.hidden = visibleSpecifications.length === 0;
    }
  }

  setText("[data-current-year]", String(new Date().getFullYear()));

  var menuButton = document.querySelector("[data-menu-toggle]");
  var menu = document.querySelector("[data-site-nav]");

  function closeMenu(returnFocus) {
    if (!menuButton || !menu) return;
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation");
    menu.dataset.open = "false";
    if (returnFocus) menuButton.focus();
  }

  if (menuButton && menu) {
    menuButton.addEventListener("click", function () {
      var willOpen = menuButton.getAttribute("aria-expanded") !== "true";
      menuButton.setAttribute("aria-expanded", String(willOpen));
      menuButton.setAttribute("aria-label", willOpen ? "Close navigation" : "Open navigation");
      menu.dataset.open = String(willOpen);
    });

    menu.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
        closeMenu(true);
      }
    });

    document.addEventListener("click", function (event) {
      if (menuButton.getAttribute("aria-expanded") === "true" &&
          !menu.contains(event.target) && !menuButton.contains(event.target)) {
        closeMenu(false);
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth >= 960) closeMenu(false);
    });
  }

  var gallery = document.querySelector("[data-gallery]");
  if (gallery) {
    var panels = Array.from(gallery.querySelectorAll("[data-gallery-panel]"));
    var thumbs = Array.from(gallery.querySelectorAll("[data-gallery-target]"));
    var activeIndex = 0;
    var touchStartX = 0;

    function showPanel(index, focusThumb) {
      activeIndex = (index + panels.length) % panels.length;
      panels.forEach(function (panel, panelIndex) {
        var selected = panelIndex === activeIndex;
        panel.hidden = !selected;
        panel.setAttribute("aria-hidden", String(!selected));
      });
      thumbs.forEach(function (thumb, thumbIndex) {
        var selected = thumbIndex === activeIndex;
        thumb.setAttribute("aria-selected", String(selected));
        thumb.tabIndex = selected ? 0 : -1;
      });
      if (focusThumb && thumbs[activeIndex]) thumbs[activeIndex].focus();
    }

    thumbs.forEach(function (thumb, index) {
      thumb.addEventListener("click", function () {
        showPanel(index, false);
        trackEvent("gallery_select", { view: thumb.textContent.trim() });
      });
      thumb.addEventListener("keydown", function (event) {
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          showPanel(activeIndex + 1, true);
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          showPanel(activeIndex - 1, true);
        }
        if (event.key === "Home") {
          event.preventDefault();
          showPanel(0, true);
        }
        if (event.key === "End") {
          event.preventDefault();
          showPanel(panels.length - 1, true);
        }
      });
    });

    var stage = gallery.querySelector("[data-gallery-stage]");
    if (stage) {
      stage.addEventListener("touchstart", function (event) {
        touchStartX = event.changedTouches[0].clientX;
      }, { passive: true });
      stage.addEventListener("touchend", function (event) {
        var distance = event.changedTouches[0].clientX - touchStartX;
        if (Math.abs(distance) > 48) showPanel(activeIndex + (distance < 0 ? 1 : -1), false);
      }, { passive: true });
    }

    showPanel(0, false);
  }

  document.addEventListener("click", function (event) {
    var eventTarget = event.target.closest("[data-analytics-event]");
    if (!eventTarget) return;
    trackEvent(eventTarget.dataset.analyticsEvent, {
      placement: eventTarget.dataset.analyticsPlacement || "unspecified",
      item_name: product ? product.name : "",
      currency: product ? product.currency : "",
      value: product && Number.isFinite(Number(product.price)) ? Number(product.price) : 0
    });
  });

  document.querySelectorAll(".faq-list details").forEach(function (details) {
    details.addEventListener("toggle", function () {
      if (!details.open) return;
      var summary = details.querySelector("summary");
      trackEvent("faq_open", { question: summary ? summary.textContent.trim() : "FAQ" });
    });
  });

  document.querySelectorAll("[data-product-video]").forEach(function (video) {
    video.addEventListener("play", function () {
      trackEvent("video_play", { provider: video.dataset.videoProvider || "local" });
    }, { once: true });
  });

  var mobileBuyBar = document.querySelector("[data-mobile-buy-bar]");
  var checkoutRoot = document.querySelector("#paypal-checkout-root") || document.querySelector("[data-paypal-checkout-root]");
  var checkoutStatus = document.querySelector("[data-checkout-status]");
  var checkoutAvailable = Boolean(product && product.checkoutEnabled);
  var alternatePurchaseSurfaces = Array.from(document.querySelectorAll(
    ".hero-actions [data-buy-cta], #checkout, .final-cta [data-buy-cta]"
  ));
  var visiblePurchaseSurfaces = new Set();
  var purchaseVisibilityReady = alternatePurchaseSurfaces.length === 0 || !("IntersectionObserver" in window);

  function updateMobileBuyBar() {
    if (!mobileBuyBar) return;
    var show = checkoutAvailable && purchaseVisibilityReady && visiblePurchaseSurfaces.size === 0;
    mobileBuyBar.dataset.hidden = String(!show);
    document.body.classList.toggle("has-mobile-buy-bar", show);
  }

  function setCheckoutStatus(message, failed) {
    if (checkoutStatus) {
      checkoutStatus.textContent = message;
      checkoutStatus.hidden = !message;
      checkoutStatus.dataset.failed = String(Boolean(failed));
    }
  }

  function showCheckoutFailure(message) {
    checkoutAvailable = false;
    updateMobileBuyBar();
    setCheckoutStatus(message, true);
    if (!checkoutRoot) return;
    checkoutRoot.replaceChildren();
    checkoutRoot.removeAttribute("aria-busy");
    var paragraph = document.createElement("p");
    var supportLink = document.createElement("a");
    paragraph.className = "checkout-fallback";
    paragraph.append(document.createTextNode(message + " "));
    supportLink.href = "/contact.html";
    supportLink.textContent = "Contact Docked Support";
    paragraph.appendChild(supportLink);
    checkoutRoot.appendChild(paragraph);
  }

  function paypalSdkUrl(paypal) {
    var parameters = new URLSearchParams({
      "client-id": paypal.clientId,
      components: paypal.components || "hosted-buttons",
      currency: product.currency
    });
    if (nonEmptyString(paypal.disableFunding)) parameters.set("disable-funding", paypal.disableFunding);
    return "https://www.paypal.com/sdk/js?" + parameters.toString();
  }

  function loadPayPalSdk(paypal) {
    if (window.paypal && window.paypal.HostedButtons) return Promise.resolve(window.paypal);
    var existing = document.querySelector("script[data-docked-paypal-sdk], script[src^='https://www.paypal.com/sdk/js']");
    return new Promise(function (resolve, reject) {
      var settled = false;
      var script = existing || appendScript(paypalSdkUrl(paypal), {
        async: "",
        "data-docked-paypal-sdk": "hosted-buttons"
      });
      function finish(error) {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else if (window.paypal && window.paypal.HostedButtons) resolve(window.paypal);
        else reject(new Error("PayPal Hosted Buttons did not initialise."));
      }
      script.addEventListener("load", function () { finish(); }, { once: true });
      script.addEventListener("error", function () { finish(new Error("PayPal could not be loaded.")); }, { once: true });
      window.setTimeout(function () {
        if (window.paypal && window.paypal.HostedButtons) finish();
        else finish(new Error("PayPal took too long to load."));
      }, 15000);
    });
  }

  function initCheckout() {
    var paypal = product && product.paypal;
    var validConfiguration = Boolean(
      product && product.checkoutEnabled && checkoutRoot && paypal &&
      nonEmptyString(paypal.clientId) && nonEmptyString(paypal.hostedButtonId)
    );
    if (!validConfiguration) {
      showCheckoutFailure("Online ordering is temporarily unavailable.");
      return;
    }

    checkoutRoot.replaceChildren();
    if (!checkoutRoot.id) checkoutRoot.id = "paypal-checkout-root";
    checkoutRoot.setAttribute("aria-busy", "true");
    setCheckoutStatus("Loading secure PayPal checkout…", false);
    loadPayPalSdk(paypal)
      .then(function (paypalSdk) {
        return paypalSdk.HostedButtons({ hostedButtonId: paypal.hostedButtonId }).render("#" + checkoutRoot.id);
      })
      .then(function () {
        checkoutRoot.removeAttribute("aria-busy");
        setCheckoutStatus("", false);
        checkoutAvailable = true;
        updateMobileBuyBar();
        trackEvent("checkout_widget_view", {
          placement: "purchase_section",
          item_name: product.name,
          currency: product.currency,
          value: Number(product.price)
        });
      })
      .catch(function () {
        showCheckoutFailure("Secure PayPal checkout could not be loaded.");
      });
  }

  if (alternatePurchaseSurfaces.length && "IntersectionObserver" in window) {
    var purchaseObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visiblePurchaseSurfaces.add(entry.target);
        else visiblePurchaseSurfaces.delete(entry.target);
      });
      purchaseVisibilityReady = true;
      updateMobileBuyBar();
    }, { threshold: 0 });
    alternatePurchaseSurfaces.forEach(function (surface) {
      purchaseObserver.observe(surface);
    });
  }

  updateMobileBuyBar();

  initCheckout();
}());
