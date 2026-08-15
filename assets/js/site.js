(function () {
  "use strict";

  var product = window.DOCKED_PRODUCT;

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
      setText("[data-product-price]", "A$" + audAmount);
    }

    document.querySelectorAll("[data-support-email]").forEach(function (link) {
      link.textContent = product.supportEmail;
      if (link.tagName === "A") {
        link.href = "mailto:" + product.supportEmail;
      }
    });
  }

  setText("[data-current-year]", String(new Date().getFullYear()));

  var menuButton = document.querySelector("[data-menu-toggle]");
  var menu = document.querySelector("[data-site-nav]");

  function closeMenu(returnFocus) {
    if (!menuButton || !menu) return;
    menuButton.setAttribute("aria-expanded", "false");
    menu.dataset.open = "false";
    if (returnFocus) menuButton.focus();
  }

  if (menuButton && menu) {
    menuButton.addEventListener("click", function () {
      var willOpen = menuButton.getAttribute("aria-expanded") !== "true";
      menuButton.setAttribute("aria-expanded", String(willOpen));
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
        panel.hidden = panelIndex !== activeIndex;
      });
      thumbs.forEach(function (thumb, thumbIndex) {
        var selected = thumbIndex === activeIndex;
        thumb.setAttribute("aria-selected", String(selected));
        thumb.tabIndex = selected ? 0 : -1;
      });
      if (focusThumb) thumbs[activeIndex].focus();
    }

    thumbs.forEach(function (thumb, index) {
      thumb.addEventListener("click", function () {
        showPanel(index, false);
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

  var mobileBuyBar = document.querySelector("[data-mobile-buy-bar]");
  var orderingSection = document.querySelector("#ordering");
  if (mobileBuyBar) {
    document.body.classList.add("has-mobile-buy-bar");
  }
  if (mobileBuyBar && orderingSection && "IntersectionObserver" in window) {
    var orderingObserver = new IntersectionObserver(function (entries) {
      mobileBuyBar.dataset.hidden = String(entries.some(function (entry) {
        return entry.isIntersecting;
      }));
    }, { threshold: 0.1 });
    orderingObserver.observe(orderingSection);
  }
}());
