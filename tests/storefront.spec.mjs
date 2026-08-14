import assert from 'node:assert/strict';
import test from 'node:test';

const previewUrl = process.env.SHOPIFY_PREVIEW_URL?.trim();

function previewRoute(route) {
  const base = new URL(previewUrl);
  const requested = new URL(route, base.origin);
  base.pathname = requested.pathname;
  for (const [key, value] of requested.searchParams) base.searchParams.set(key, value);
  return base.toString();
}

async function clearOptionalAgeGate(page) {
  const dialog = page.locator('[data-docked-age-dialog][open]');
  if (await dialog.count()) {
    await dialog.locator('[data-docked-age-confirm]').click();
  }
}

async function assertBasicAccessibility(page, label) {
  assert.ok(await page.locator('html[lang]').count(), `${label}: html must declare a language`);
  assert.ok(await page.locator('main').count(), `${label}: main landmark is missing`);
  assert.ok(await page.locator('h1').count(), `${label}: page must include an h1`);

  const missingImageAlt = await page.locator('img:not([alt])').count();
  assert.equal(missingImageAlt, 0, `${label}: every image must have an alt attribute`);

  const unnamedControls = await page.locator('button:visible, input:visible, select:visible, textarea:visible').evaluateAll(
    (controls) =>
      controls
        .filter((control) => {
          const id = control.id;
          const labelled = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
          return !(
            control.getAttribute('aria-label') ||
            control.getAttribute('aria-labelledby') ||
            control.getAttribute('title') ||
            control.getAttribute('placeholder') ||
            control.textContent?.trim() ||
            labelled
          );
        })
        .map((control) => control.outerHTML.slice(0, 180)),
  );
  assert.deepEqual(unnamedControls, [], `${label}: visible controls need accessible names`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 2, `${label}: page overflows horizontally by ${overflow}px`);

  const prelaunch = await page.locator('.docked-prelaunch-banner').count();
  if (prelaunch) {
    const enabledPurchases = await page.locator('button[name="add"]:enabled, button[name="checkout"]:enabled').count();
    assert.equal(enabledPurchases, 0, `${label}: prelaunch pages must not expose enabled purchase buttons`);
  }
}

test(
  'Shopify preview passes desktop and mobile storefront smoke checks',
  { skip: !previewUrl && 'Set SHOPIFY_PREVIEW_URL to run browser smoke tests.' },
  async () => {
    let chromium;
    try {
      ({ chromium } = await import('playwright'));
    } catch (error) {
      throw new Error(
        `SHOPIFY_PREVIEW_URL is set, but Playwright is not installed. Run "npm install --no-save playwright" first. ${error.message}`,
      );
    }

    const browser = await chromium.launch({ headless: true });
    try {
      for (const device of [
        { label: 'mobile-320', viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true },
        { label: 'mobile-360', viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true },
        { label: 'mobile-375', viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
        { label: 'mobile-390', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
        { label: 'tablet-768', viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true },
        { label: 'desktop-1024', viewport: { width: 1024, height: 768 } },
        { label: 'desktop-1440', viewport: { width: 1440, height: 1000 } },
      ]) {
        const context = await browser.newContext({
          viewport: device.viewport,
          isMobile: device.isMobile,
          hasTouch: device.hasTouch,
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();

        for (const route of ['/', '/collections/all', '/cart', '/search?q=pool']) {
          const response = await page.goto(previewRoute(route), { waitUntil: 'domcontentloaded' });
          assert.ok(response, `${device.label} ${route}: navigation returned no response`);
          assert.ok(response.status() < 400, `${device.label} ${route}: HTTP ${response.status()}`);
          await clearOptionalAgeGate(page);
          assert.ok((await page.title()).trim(), `${device.label} ${route}: document title is empty`);
          await assertBasicAccessibility(page, `${device.label} ${route}`);
        }

        await page.goto(previewRoute('/'), { waitUntil: 'domcontentloaded' });
        await clearOptionalAgeGate(page);
        const finder = page.locator('[data-docked-finder]');
        if (await finder.count()) {
          await finder.locator('[name="finder-powered"]').selectOption('no');
          await finder.locator('[name="finder-style"]').selectOption('social');
          const target = await finder.locator('[data-docked-finder-link]').getAttribute('href');
          assert.match(target ?? '', /adult-pool-games/, `${device.label}: float finder should route social use to games`);
        }

        await context.close();
      }
    } finally {
      await browser.close();
    }
  },
);
