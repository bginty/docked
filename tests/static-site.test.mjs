import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const pages = ['index.html', 'safety.html', 'shipping-returns.html', 'privacy.html', 'terms.html', 'contact.html', 'warranty.html', 'thank-you.html', '404.html'];
const visibleText = (html) => html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function productConfig() {
  const context = { window: {} };
  vm.runInNewContext(read('assets/js/product-config.js'), context);
  return context.window.DOCKED_PRODUCT;
}

test('checkout state is internally consistent and never uses a placeholder', () => {
  const configSource = read('assets/js/product-config.js');
  const config = productConfig();
  const html = pages.map(read).join('\n');
  const site = read('assets/js/site.js');
  const enabled = config.checkoutEnabled === true;
  if (enabled) {
    assert.ok(config.paypal.clientId.length >= 40);
    assert.ok(config.paypal.hostedButtonId.length >= 8);
    assert.equal((html.match(/https:\/\/www\.paypal\.com\/sdk\/js/g) ?? []).length, 0);
    assert.doesNotMatch(html, new RegExp(config.paypal.clientId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(html, new RegExp(config.paypal.hostedButtonId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(site, new RegExp(config.paypal.clientId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(site, new RegExp(config.paypal.hostedButtonId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal((configSource.match(new RegExp(config.paypal.clientId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, 1);
    assert.equal((configSource.match(new RegExp(config.paypal.hostedButtonId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, 1);
    assert.match(site, /https:\/\/www\.paypal\.com\/sdk\/js/);
    assert.match(site, /\.clientId\b/);
    assert.match(site, /\.hostedButtonId\b/);
    assert.match(site, /paypal\.HostedButtons/);
    assert.equal((html.match(/id=["']paypal-checkout-root["']/g) ?? []).length, 1);
    assert.equal((html.match(/\bdata-paypal-checkout-root\b/g) ?? []).length, 1);
  } else {
    assert.equal(config.checkoutEnabled, false);
    assert.equal(config.paypal.clientId, '');
    assert.equal(config.paypal.hostedButtonId, '');
    assert.doesNotMatch(html, /paypal\.HostedButtons|paypal-container-|https:\/\/www\.paypal\.com\/sdk\/js/i);
  }
  assert.doesNotMatch(html, /PASTE_|REAL_PAYPAL|href=["']#["'][^>]*>\s*(?:Buy|Pay|Order)/i);
});

test('homepage has the one-product PayPal ordering contract', () => {
  const index = read('index.html');
  const config = productConfig();
  const site = read('assets/js/site.js');
  const marketing = `${visibleText(index)} ${JSON.stringify(config)} ${read('site.webmanifest')}`;
  assert.match(index, /Docked Cruise D2/);
  assert.match(index, /data-product-price/);
  const checkout = index.slice(index.search(/<section\b[^>]*\bid=["']checkout["']/i), index.indexOf('</section>', index.search(/<section\b[^>]*\bid=["']checkout["']/i)) + 10);
  assert.match(checkout, /18\+/i);
  assert.match(checkout, /competent swimmers/i);
  assert.match(checkout, /calm, controlled swimming pools/i);
  assert.match(checkout, /not a life-saving device/i);
  assert.equal((index.match(/18\+/g) ?? []).length, 1);
  assert.match(index, /handled securely by PayPal/i);
  assert.match(index, /does not collect card details/i);
  assert.match(index, /Free worldwide shipping/);
  assert.match(index, /cruise-d2-pool-1200\.webp/);
  assert.match(index, /cruise-d2-overview-1200\.webp/);
  assert.match(index, /cruise-d2-controls-1200\.webp/);
  assert.match(index, /cruise-d2-features\.jpg/);
  assert.match(index, /data-cruise-d2-feature-image/);
  assert.match(index, /data-mobile-buy-bar/);
  assert.match(index, /id=["']checkout["']/);
  assert.match(index, /data-product-specifications/);
  assert.ok(Array.isArray(config.specifications));
  assert.ok(config.specifications.some((specification) => specification.value === null));
  assert.match(site, /specifications(?:\s*\?\?\s*\[\])?\.filter\([\s\S]{0,320}?(?:\.value\s*!={1,2}\s*null|nonEmptyString\([^)]*\.value\))/i);
  for (const pattern of [
    /\bmotorised\s+(?:inflatable\s+)?(?:water|pool)\s+lounger\b/i,
    /\bup to 5\s*km\/h\b/i,
    /\b160\s*kg\b/i,
    /\belectric\s+propulsion\b/i,
    /\bdual[- ]joystick\b/i,
    /\bcup holders?\b/i,
    /\bsupportive\s+headrest\b/i,
  ]) assert.match(marketing, pattern);
  assert.doesNotMatch(index, /unverified performance|original brand illustrations|the Docked approach|confirmed before dispatch/i);
  assert.doesNotMatch(index, /\b(?:in stock|sale|limited time|only \d+ left|rating|reviews?)\b/i);
});

test('all homepage purchase calls to action share the real checkout target', () => {
  const index = read('index.html');
  const ctas = [...index.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].filter((match) => /\bdata-buy-cta\b/i.test(match[1]));
  assert.ok(ctas.length >= 4, `expected at least four purchase opportunities, found ${ctas.length}`);
  for (const cta of ctas) assert.match(cta[1], /\bhref=["']#checkout["']/i);

  const purchaseLike = [...index.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].filter((match) => {
    const text = visibleText(match[2]);
    return /\b(?:buy|order|get)\b/i.test(text) && /\b(?:cruise d2|now|checkout)\b/i.test(text);
  });
  for (const cta of purchaseLike) {
    assert.match(cta[1], /\bdata-buy-cta\b/i);
    assert.match(cta[1], /\bhref=["']#checkout["']/i);
  }
});

test('Cruise D2 is never marketed as a dock, open-water craft, or safety-certified product', () => {
  const marketing = `${visibleText(read('index.html'))} ${JSON.stringify(productConfig())} ${read('site.webmanifest')}`;
  for (const pattern of [
    /\b(?:inflatable\s+)?floating\s+(?:dock|platform)\b/i,
    /\bprivate\s+deck\b/i,
    /\b(?:beside|attach(?:ed|es|ing)?\s+to)\s+(?:a|the)\s+boat\b/i,
    /\bsafe\b/i,
    /\bunsinkable\b/i,
    /\b(?:ocean|surf|boating)\b/i,
    /\bwaterproof\s+(?:electronics?|electrical|motor|battery|controller?|controls?)\b/i,
    /\bmarine[- ]certified\b/i,
    /\bcoast\s+guard\b/i,
    /\baustralian\s+standards?\b/i,
    /\bpuncture[- ]proof\b/i,
    /\bcommercial[- ]grade\b/i,
    /\ball[- ]day\b/i,
    /\blong[- ]range\b/i,
    /\bcompletely\s+stable\b/i,
  ]) assert.doesNotMatch(marketing, pattern);
  assert.doesNotMatch(marketing, /160\s*kg.{0,100}\b(?:safe|safety|stable|stability|strength|certified|approved|tested)\b/is);
  assert.doesNotMatch(marketing, /\b(?:safe|safety|stable|stability|strength|certified|approved|tested)\b.{0,100}160\s*kg/is);
});

test('all public pages share the core navigation and legal identity', () => {
  for (const file of pages) {
    const html = read(file);
    assert.match(html, /support@docked\.com\.au/);
    assert.match(html, /Ginty United Investments Pty Ltd/);
    assert.match(html, /href=["']\/?safety\.html["']/);
    assert.match(html, /href=["']\/?shipping-returns\.html["']/);
    assert.match(html, /href=["']\/?privacy\.html["']/);
    assert.match(html, /href=["']\/?terms\.html["']/);
    assert.match(html, /href=["']\/?contact\.html["']/);
    assert.match(html, /href=["']\/?warranty\.html["']/);
    assert.match(html, /data-menu-toggle/);
    assert.match(html, /data-site-nav/);
  }
  const sitemap = read('sitemap.xml');
  assert.match(sitemap, /https:\/\/docked\.com\.au\/contact\.html/);
  assert.match(sitemap, /https:\/\/docked\.com\.au\/warranty\.html/);
});

test('CSS includes mobile, focus, and reduced-motion safeguards', () => {
  const css = read('assets/css/styles.css');
  assert.match(css, /@media\s*\([^)]*max-width\s*:\s*(?:360px|43\.99rem)/i);
  assert.match(css, /@media\s*\([^)]*prefers-reduced-motion\s*:\s*reduce/i);
  assert.match(css, /:focus-visible/i);
  assert.match(css, /\.site-nav \.nav-cta\s*\{[^}]*background:\s*var\(--coral-dark\)/s);
  assert.match(css, /\.mobile-buy-bar/);
  assert.match(css, /--pool-text:\s*#087b98/i);
  assert.doesNotMatch(css, /width\s*:\s*100vw/i);
  assert.doesNotMatch(css, /overflow-x\s*:\s*(?:hidden|clip)/i);

  const featureRule = [...css.matchAll(/[^{}]*\[data-cruise-d2-feature-image\][^{]*\{([^}]*)\}/gi)].map((match) => match[1]).join('\n');
  assert.match(featureRule, /object-fit\s*:\s*contain/i);
  assert.match(featureRule, /width\s*:\s*100%/i);
  assert.match(featureRule, /max-width\s*:\s*100%/i);
  assert.match(featureRule, /height\s*:\s*auto/i);
  assert.doesNotMatch(featureRule, /object-fit\s*:\s*cover|object-position\s*:|clip-path\s*:/i);
});

test('supplier feature image is a real responsive JPEG and is not cropped', () => {
  const file = path.join(root, 'assets/images/product/cruise-d2-features.jpg');
  const bytes = fs.readFileSync(file);
  assert.ok(bytes.length > 10_000);
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xd8);
  assert.ok(bytes.subarray(0, 64).includes(Buffer.from('JFIF\0', 'ascii')));
  assert.equal(bytes.at(-2), 0xff);
  assert.equal(bytes.at(-1), 0xd9);
  assert.equal(
    createHash('sha256').update(bytes).digest('hex').toUpperCase(),
    '3BA244A638F4B9A0A612A6A01AD98D9B940BFCF8B2881593F3F76D272835A523',
  );

  const image = read('index.html').match(/<img\b(?=[^>]*\bdata-cruise-d2-feature-image\b)[^>]*>/i)?.[0] ?? '';
  assert.match(image, /src=["']\/assets\/images\/product\/cruise-d2-features\.jpg["']/i);
  assert.match(image, /\bwidth=["']\d+["']/i);
  assert.match(image, /\bheight=["']\d+["']/i);
  assert.match(image, /\balt=["'][^"']+["']/i);
});

test('legacy finance and Shopify references are absent from production output', () => {
  const files = [...pages, 'assets/css/styles.css', 'assets/js/product-config.js', 'assets/js/site.js', 'site.webmanifest', 'robots.txt', 'sitemap.xml'];
  const output = files.map(read).join('\n');
  assert.doesNotMatch(output, /\b(?:mortgage|broker|borrowing|affordability|refinance|lender|repayment|credit assistance|bank statement)\b/i);
  assert.doesNotMatch(output, /shopify|myshopify|cdn\.shopify/i);
});
