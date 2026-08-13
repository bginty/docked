(() => {
  const STORAGE_KEY = 'docked-adult-confirmed-v1';

  const onReady = (callback) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  };

  class DockedStickyAtc extends HTMLElement {
    connectedCallback() {
      this.button = this.querySelector('button');
      this.source = document.getElementById(this.dataset.sourceButton);
      if (!this.button || !this.source) return;

      this.button.addEventListener('click', () => this.source.click());
      this.sync = () => {
        this.button.disabled = this.source.disabled;
        if (!this.hasAttribute('data-fixed-label')) {
          const sourceText = this.source.querySelector('span')?.textContent?.trim();
          if (sourceText) this.button.textContent = sourceText;
        }
      };
      this.observer = new MutationObserver(this.sync);
      this.observer.observe(this.source, { attributes: true, childList: true, subtree: true });
      this.sync();
    }

    disconnectedCallback() {
      this.observer?.disconnect();
    }
  }

  if (!customElements.get('docked-sticky-atc')) {
    customElements.define('docked-sticky-atc', DockedStickyAtc);
  }

  onReady(() => {
    const ageDialog = document.querySelector('[data-docked-age-dialog]');
    const confirmed = (() => {
      try {
        return sessionStorage.getItem(STORAGE_KEY) === 'true';
      } catch (_error) {
        return false;
      }
    })();

    if (ageDialog && !confirmed) {
      ageDialog.showModal();
      ageDialog.querySelector('[data-docked-age-confirm]')?.addEventListener('click', () => {
        try {
          sessionStorage.setItem(STORAGE_KEY, 'true');
        } catch (_error) {
          // Session storage can be unavailable in strict privacy modes.
        }
        ageDialog.close();
      });
    }

    document.querySelectorAll('[data-docked-finder]').forEach((finder) => {
      const powered = finder.querySelector('[name="finder-powered"]');
      const style = finder.querySelector('[name="finder-style"]');
      const link = finder.querySelector('[data-docked-finder-link]');
      const update = () => {
        if (!link) return;
        const poweredUrl = finder.dataset.poweredUrl;
        const loungersUrl = finder.dataset.loungersUrl;
        const gamesUrl = finder.dataset.gamesUrl;
        let target = powered?.value === 'yes' ? poweredUrl : loungersUrl;
        if (style?.value === 'social') target = gamesUrl;
        link.href = target || '/collections/all';
      };
      powered?.addEventListener('change', update);
      style?.addEventListener('change', update);
      update();
    });
  });
})();
