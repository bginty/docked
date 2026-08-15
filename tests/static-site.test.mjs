import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('checkout state is internally consistent and never uses a placeholder', () => {
  const config = read('assets/js/product-config.js');
  const pages = ['index.html', 'safety.html', 'shipping-returns.html', 'privacy.html', 'terms.html', 'thank-you.html', '404.html'].map(read).join('\n');
  const enabled = /checkoutEnabled\s*:\s*true\b/.test(config);
  if (enabled) {
    const id = config.match(/paypalHostedButtonId\s*:\s*["']([^"']+)["']/)?.[1];
    assert.ok(id && id.length >= 8);
    assert.match(config, /paypalIntegration\s*:\s*["']hosted-buttons["']/);
    assert.equal((pages.match(/https:\/\/www\.paypal\.com\/sdk\/js\?/g) ?? []).length, 1);
    assert.match(pages, /components=hosted-buttons/);
    assert.match(pages, /currency=AUD/);
    assert.equal((pages.match(new RegExp(`id=["']paypal-container-${id}["']`, 'g')) ?? []).length, 1);
    assert.equal((pages.match(new RegExp(`hostedButtonId:\\s*["']${id}["']`, 'g')) ?? []).length, 1);
  } else {
    assert.match(config, /checkoutEnabled\s*:\s*false\b/);
    assert.match(config, /paypalIntegration\s*:\s*["']\s*["']/);
    assert.match(config, /paypalHostedButtonId\s*:\s*["']\s*["']/);
    assert.doesNotMatch(pages, /paypal\.HostedButtons|paypal-container-|https:\/\/www\.paypal\.com\/sdk\/js/i);
  }
  assert.match(config, /paypalPaymentLink\s*:\s*['"]\s*['"]/);
  assert.doesNotMatch(pages, /PASTE_|REAL_PAYPAL|href=["']#["'][^>]*>\s*(?:Buy|Pay|Order)/i);
});

test('homepage has the one-product PayPal ordering contract', () => {
  const index = read('index.html');
  assert.match(index, /Docked Cruise D2/);
  assert.match(index, /data-product-price/);
  assert.match(index, /Adults 18\+ only\. For competent swimmers in calm, controlled swimming pools\. Not a life-saving device\./);
  assert.match(index, /Secure checkout powered by PayPal\./);
  assert.match(index, /Free worldwide shipping/);
  assert.doesNotMatch(index, /\b(?:in stock|sale|limited time|only \d+ left|rating|reviews?)\b/i);
});

test('all public pages share the core navigation and legal identity', () => {
  for (const file of ['index.html', 'safety.html', 'shipping-returns.html', 'privacy.html', 'terms.html', 'thank-you.html', '404.html']) {
    const html = read(file);
    assert.match(html, /support@docked\.com\.au/);
    assert.match(html, /Ginty United Investments Pty Ltd/);
    assert.match(html, /href=["']\/?safety\.html["']/);
    assert.match(html, /href=["']\/?shipping-returns\.html["']/);
    assert.match(html, /href=["']\/?privacy\.html["']/);
    assert.match(html, /href=["']\/?terms\.html["']/);
    assert.match(html, /data-menu-toggle/);
    assert.match(html, /data-site-nav/);
  }
});

test('CSS includes mobile, focus, and reduced-motion safeguards', () => {
  const css = read('assets/css/styles.css');
  assert.match(css, /@media\s*\([^)]*max-width\s*:\s*(?:360px|43\.99rem)/i);
  assert.match(css, /@media\s*\([^)]*prefers-reduced-motion\s*:\s*reduce/i);
  assert.match(css, /:focus-visible/i);
  assert.match(css, /\.site-nav \.nav-cta\s*\{[^}]*background:\s*var\(--coral-dark\)/s);
  assert.doesNotMatch(css, /width\s*:\s*100vw/i);
});

test('legacy finance and Shopify references are absent from production output', () => {
  const files = ['index.html', 'safety.html', 'shipping-returns.html', 'privacy.html', 'terms.html', 'thank-you.html', '404.html', 'assets/css/styles.css', 'assets/js/product-config.js', 'assets/js/site.js', 'site.webmanifest', 'robots.txt', 'sitemap.xml'];
  const output = files.map(read).join('\n');
  assert.doesNotMatch(output, /\b(?:mortgage|broker|borrowing|affordability|refinance|lender|repayment|credit assistance|bank statement)\b/i);
  assert.doesNotMatch(output, /shopify|myshopify|cdn\.shopify/i);
});
