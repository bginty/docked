import assert from 'node:assert/strict';
import test from 'node:test';

import {
  THEME_ROOT,
  auditCopy,
  formatReport,
  parseCsv,
  validateTheme,
} from '../scripts/validate-theme.mjs';

test('the committed theme passes every structural launch guard', () => {
  const report = validateTheme(THEME_ROOT);
  assert.equal(report.ok, true, `Theme validation failed:\n${formatReport(report)}`);
  assert.equal(report.stats.catalogueRows, 15);
  assert.equal(report.stats.draftProducts, 15);
  assert.equal(report.stats.activeProducts, 0);
});

test('the configured storefront copy audit is clean', () => {
  assert.deepEqual(auditCopy(THEME_ROOT), []);
  const report = validateTheme(THEME_ROOT, { copyOnly: true });
  assert.equal(report.ok, true, formatReport(report));
});

test('remaining product and interaction requirements have dedicated passing gates', () => {
  const requiredChecks = [
    'product.compatible-accessories',
    'product.faq-surface',
    'product.enabled-payment-icons',
    'cards.verified-availability',
    'comparison.anchor-integrity',
    'comparison.distinct-products',
    'comparison.readiness-default',
    'finder.group-semantics',
    'css.shared-safety-prelaunch',
    'css.dark-surface-contrast',
    'tax.gst-copy-gates',
    'prelaunch.price-badges-hidden',
    'prelaunch.card-badges-hidden',
    'prelaunch.central-price-neutral',
    'prelaunch.inventory-neutral',
    'prelaunch.product-schema-hidden',
    'prelaunch.variant-options-neutral',
    'prelaunch.variant-submit-state',
    'prelaunch.blank-product-fallback',
    'prelaunch.volume-pricing-hidden',
    'prelaunch.pickup-hidden',
    'structured-data.faq-visible-derived',
    'structured-data.organization',
    'browser.viewport-matrix',
    'prelaunch.sticky-fixed-label',
    'contact.address-escaping',
    'newsletter.section-scoped-ids',
  ];
  const report = validateTheme(THEME_ROOT);
  const passedCodes = new Set(report.passed.map((check) => check.code));
  const missing = requiredChecks.filter((code) => !passedCodes.has(code));
  const relevantErrors = report.errors.filter((error) => requiredChecks.includes(error.code));
  assert.deepEqual(missing, [], `Unmet remaining theme gates:\n${JSON.stringify(relevantErrors, null, 2)}`);
});

test('the built-in CSV parser preserves commas and escaped quotes', () => {
  const rows = parseCsv('Name,Notes,Status\r\n"Float, Large","Says ""hello""",Draft\r\n');
  assert.deepEqual(rows, [{ Name: 'Float, Large', Notes: 'Says "hello"', Status: 'Draft' }]);
});
