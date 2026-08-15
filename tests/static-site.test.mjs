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
    assert.equal(createHash('sha256').update(config.paypal.clientId).digest('hex').toUpperCase(), '2679020198760B81224A5A742EA2574BCFEEDA85A11CBC84B3C638D2F2FB207F');
    assert.equal(createHash('sha256').update(config.paypal.hostedButtonId).digest('hex').toUpperCase(), 'A83A02BEAA6ADD3FB65A29CBD09F0DAF7714AC8982161D804205147242274C1C');
    assert.equal(config.paypal.components, 'hosted-buttons');
    assert.equal(config.paypal.disableFunding, 'venmo');
    assert.equal(config.currency, 'AUD');
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
  assert.match(index, /Free shipping/);
  assert.match(index, /cruise-d2-lifestyle-man-1200\.webp/);
  assert.match(index, /cruise-d2-lifestyle-woman-1200\.webp/);
  assert.match(index, /cruise-d2-features\.jpg/);
  assert.match(index, /data-cruise-d2-feature-image/);
  assert.match(index, /data-mobile-buy-bar/);
  assert.match(index, /data-persistent-buy-bar/);
  assert.match(index, /data-gallery[^>]*data-product-gallery/);
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

test('approved top-of-page sequence and offer language remain exact', () => {
  const index = read('index.html');
  const site = read('assets/js/site.js');
  const customerFacingFiles = [...pages, 'assets/js/product-config.js', 'assets/js/site.js', 'site.webmanifest'];
  const obsoleteOfferLanguage = [];
  for (const file of customerFacingFiles) {
    const source = read(file);
    if (/A(?:\s|&nbsp;)*(?:\$|&#0*36;|&#x0*24;|&dollar;)/i.test(source)) obsoleteOfferLanguage.push(`${file}: A$ prefix`);
    if (/\bworldwide\b/i.test(source)) obsoleteOfferLanguage.push(`${file}: worldwide`);
  }
  assert.deepEqual(obsoleteOfferLanguage, []);

  const headerEnd = index.search(/<\/header\s*>/i);
  assert.ok(headerEnd >= 0, 'homepage must have a closing header');
  const closingHeader = index.slice(headerEnd).match(/^<\/header\s*>/i)?.[0] ?? '';
  const afterHeader = index.slice(headerEnd + closingHeader.length);
  const firstImage = afterHeader.match(/<img\b[^>]*>/i)?.[0] ?? '';
  assert.match(firstImage, /\bdata-cruise-d2-feature-image\b/i, 'feature graphic must be the first image after the header');

  const sequence = [
    afterHeader.search(/<img\b(?=[^>]*\bdata-cruise-d2-feature-image\b)[^>]*>/i),
    afterHeader.search(/<h1\b[^>]*\bid=["']hero-title["']/i),
    afterHeader.search(/A motorised inflatable water lounger with dual joystick control\./i),
    afterHeader.search(/<div\b[^>]*class=["'][^"']*\bhero-offer\b/i),
    afterHeader.search(/Buy Cruise D2\s*—\s*\$649/i),
    afterHeader.search(/Explore the features/i),
    afterHeader.search(/Electric propulsion[\s\S]{0,260}Up to 5\s*km\/h[\s\S]{0,260}160\s*kg capacity[\s\S]{0,260}Dual joystick steering/i),
  ];
  sequence.forEach((position, indexInSequence) => {
    assert.ok(position >= 0, `approved hero item ${indexInSequence + 1} is missing`);
    if (indexInSequence > 0) assert.ok(position > sequence[indexInSequence - 1], `approved hero item ${indexInSequence + 1} is out of order`);
  });
  const firstSectionEnd = afterHeader.search(/<\/section\s*>/i);
  assert.ok(firstSectionEnd > sequence[0], 'feature graphic must live in the first major section after the header');
  assert.ok(afterHeader.search(/<div\b[^>]*class=["'][^"']*\bhero-copy\b/i) > sequence[0], 'feature graphic must precede hero copy in the DOM');

  const priceTargets = [...index.matchAll(/<([a-z][a-z0-9]*)\b(?=[^>]*\bdata-product-price\b)[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => visibleText(match[2]));
  assert.ok(priceTargets.length >= 3, `expected repeated price targets, found ${priceTargets.length}`);
  assert.deepEqual([...new Set(priceTargets)], ['$649']);
  const heroOffer = index.match(/<div\b[^>]*class=["'][^"']*\bhero-offer\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
  assert.equal(visibleText(heroOffer), '$649 AUD · Free shipping');
  assert.match(index, />\s*Buy Cruise D2\s*—\s*\$649\s*</i);
  assert.match(site, /setText\(\s*["']\[data-product-price\]["']\s*,\s*["']\$["']\s*\+\s*audAmount\s*\)/);
  assert.equal(productConfig().price, 649);
  assert.equal(productConfig().currency, 'AUD');
});

test('approved summer revision keeps the brand and simplifies the sales hierarchy', () => {
  const index = read('index.html');
  const css = read('assets/css/styles.css');
  const config = productConfig();
  const section = (startPattern) => {
    const start = index.search(startPattern);
    const end = start >= 0 ? index.indexOf('</section>', start) : -1;
    return start >= 0 && end > start ? index.slice(start, end + 10) : '';
  };
  const hero = section(/<section\b[^>]*class=["'][^"']*\bhero\b/i);
  const value = section(/<section\b[^>]*class=["'][^"']*\bvalue-section\b/i);
  const controls = section(/<section\b[^>]*aria-labelledby=["']control-title["']/i);
  const specifications = section(/<section\b[^>]*id=["']specifications["']/i);
  const brandLink = index.match(/<a\b(?=[^>]*class=["'][^"']*\bbrand\b)[^>]*>[\s\S]*?<\/a>/i)?.[0] ?? '';

  assert.equal(config.brand, 'Docked');
  assert.equal(config.name, 'Docked Cruise D2');
  assert.match(brandLink, /href=["']\/["']/i);
  assert.match(brandLink, /src=["']\/assets\/images\/brand-mark\.svg["']/i);
  assert.match(brandLink, /alt=["']Docked["']/i);

  assert.ok(hero);
  assert.doesNotMatch(hero, /\beyebrow\b/i);
  assert.ok(value);
  assert.doesNotMatch(index, /Full-length lounging profile/i);
  assert.ok(specifications);
  assert.match(specifications, /<h2\b[^>]*id=["']specifications-title["'][^>]*>\s*Cruise D2 specifications\.\s*<\/h2>/i);
  assert.doesNotMatch(specifications, /\beyebrow\b/i);
  assert.doesNotMatch(specifications, /class=["'][^"']*\blede\b/i);

  assert.match(value, /cruise-d2-lifestyle-man-600\.webp[\s\S]*cruise-d2-lifestyle-man-1200\.webp/i);
  assert.doesNotMatch(value, /cruise-d2-overview-(?:600|1200)\.webp/i);
  assert.match(controls, /cruise-d2-lifestyle-woman-600\.webp[\s\S]*cruise-d2-lifestyle-woman-1200\.webp/i);
  assert.doesNotMatch(controls, /cruise-d2-controls-(?:600|1200)\.webp/i);

  assert.match(css, /--sunshine\s*:\s*#ffd43b\b/i);
  assert.match(css, /--sunshine-deep\s*:\s*#edae00\b/i);
  assert.match(css, /--pool-bright\s*:\s*#13bfe6\b/i);
  assert.match(css, /--coral\s*:\s*#e95032\b/i);
  assert.ok((css.match(/var\(--sunshine\)/g) ?? []).length >= 4);
  assert.ok((css.match(/var\(--sunshine-deep\)/g) ?? []).length >= 1);

  const persistent = index.match(/<aside\b(?=[^>]*data-persistent-buy-bar)[^>]*>[\s\S]*?<\/aside>/i)?.[0] ?? '';
  const baseRule = css.match(/\.mobile-buy-bar\s*\{([^}]*)\}/i)?.[1] ?? '';
  const printMediaPosition = css.search(/@media\s+print\b/i);
  const screenCss = css.slice(0, printMediaPosition >= 0 ? printMediaPosition : css.length);
  const persistentRules = [...screenCss.matchAll(/[^{}]*\.(?:mobile-buy-bar|persistent-buy-bar)[^{]*\{([^}]*)\}/gi)].map((match) => match[1]).join('\n');
  assert.match(persistent, /class=["'][^"']*\bmobile-buy-bar\b[^"']*\bpersistent-buy-bar\b[^"']*["']/i);
  assert.match(persistent, /aria-label=["'][^"']+["']/i);
  assert.match(persistent, /<a\b(?=[^>]*data-buy-cta)(?=[^>]*href=["']#checkout["'])[^>]*>/i);
  assert.match(baseRule, /position\s*:\s*fixed/i);
  assert.match(baseRule, /display\s*:\s*(?:flex|grid)/i);
  assert.doesNotMatch(persistentRules, /display\s*:\s*none/i);
  const site = read('assets/js/site.js');
  assert.match(site, /querySelectorAll\(\s*["']\.hero-actions \[data-buy-cta\], #checkout, \.final-cta \[data-buy-cta\]["']\s*\)/i);
  assert.match(site, /visiblePurchaseSurfaces\s*=\s*new Set\(\)/i);
  assert.match(site, /purchaseVisibilityReady\s*=/i);
  assert.match(site, /new IntersectionObserver\(/i);
  assert.match(site, /entry\.isIntersecting[\s\S]{0,120}visiblePurchaseSurfaces\.add\(entry\.target\)[\s\S]{0,120}visiblePurchaseSurfaces\.delete\(entry\.target\)/i);
  assert.match(site, /purchaseObserver\.observe\(surface\)/i);
  assert.match(site, /var\s+show\s*=\s*checkoutAvailable\s*&&\s*purchaseVisibilityReady\s*&&\s*visiblePurchaseSurfaces\.size\s*===\s*0\s*;/i);
  assert.match(site, /dataset\.hidden\s*=\s*String\(!show\)/i);
});

test('published supplier illustrations disclose AI provenance visibly and in the asset register', () => {
  const index = read('index.html');
  const css = read('assets/css/styles.css');
  const register = read('docs/STATIC_SITE_ASSET_REGISTER.md');
  const figures = [...index.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi)].map((match) => match[0]);
  const media = [
    'cruise-d2-features.jpg',
    'cruise-d2-lifestyle-man-1200.webp',
    'cruise-d2-lifestyle-woman-1200.webp',
  ];
  for (const file of media) {
    const figure = figures.find((candidate) => candidate.includes(file)) ?? '';
    assert.ok(figure, `${file} must be inside an associated figure`);
    const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const image = figure.match(new RegExp(`<img\\b(?=[^>]*${escaped})[^>]*>`, 'i'))?.[0] ?? '';
    assert.match(image, /alt=["'][^"']*\billustration\b[^"']*["']/i, `${file} alt must identify it as an illustration`);
    const disclosure = figure.match(/<([a-z][a-z0-9]*)\b(?=[^>]*class=["'][^"']*\bmedia-disclosure\b)[^>]*>([\s\S]*?)<\/\1>/i);
    assert.ok(disclosure, `${file} needs an associated media-disclosure element`);
    assert.match(visibleText(disclosure[2]), /supplier\s+(?:product|lifestyle)\s+illustration/i);
    const openingTag = disclosure[0].slice(0, disclosure[0].indexOf('>') + 1);
    assert.doesNotMatch(openingTag, /\bhidden\b|aria-hidden=["']true["']/i);
  }
  const disclosureRules = [...css.matchAll(/[^{}]*\.media-disclosure[^{]*\{([^}]*)\}/gi)].map((match) => match[1]).join('\n');
  assert.doesNotMatch(disclosureRules, /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\D|$)|clip(?:-path)?\s*:/i);

  assert.match(register, /C2PA/i);
  assert.match(register, /gpt-image\s+v2\.0/i);
  assert.match(register, /trainedAlgorithmicMedia/i);
  assert.match(register, /supplier(?:[- ]provided)?(?:\s+(?:product|lifestyle))?\s+illustrations?/i);
  for (const anchor of [/cruise-d2-features\.jpg/i, /Man on Float\.png/i, /Girl on Float\.png/i]) {
    const occurrences = [...register.matchAll(new RegExp(anchor.source, 'gi'))];
    assert.ok(occurrences.some((match) => {
      const excerpt = register.slice(Math.max(0, match.index - 2500), match.index + match[0].length + 2500);
      return /C2PA/i.test(excerpt) && /gpt-image\s+v2\.0/i.test(excerpt) && /trainedAlgorithmicMedia/i.test(excerpt);
    }), `${anchor} must be associated with the explicit C2PA provenance record`);
  }
  assert.doesNotMatch(register, /Actual source encoding[^\n]*no embedded image metadata/i);
  assert.doesNotMatch(register, /Neither PNG contains embedded image metadata/i);
});

test('product slideshow has complete tab semantics and keyboard controls', () => {
  const index = read('index.html');
  const site = read('assets/js/site.js');
  assert.match(index, /data-gallery[^>]*data-product-gallery/i);
  const stage = index.match(/<([a-z][a-z0-9]*)\b(?=[^>]*data-gallery-stage)[^>]*>/i)?.[0] ?? '';
  assert.match(stage, /aria-live=["']polite["']/i);
  assert.match(stage, /aria-describedby=["'][^"']+["']/i);

  const panels = [...index.matchAll(/<figure\b(?=[^>]*data-gallery-panel)([^>]*)>/gi)].map((match) => match[1]);
  const tabs = [...index.matchAll(/<button\b(?=[^>]*data-gallery-target)([^>]*)>/gi)].map((match) => match[1]);
  assert.equal(panels.length, 3);
  assert.equal(tabs.length, 3);
  const panelIds = new Set(panels.map((attrs) => attrs.match(/id=["']([^"']+)["']/i)?.[1]).filter(Boolean));
  const tabIds = new Set(tabs.map((attrs) => attrs.match(/id=["']([^"']+)["']/i)?.[1]).filter(Boolean));
  assert.equal(panelIds.size, 3);
  assert.equal(tabIds.size, 3);
  for (const attrs of panels) {
    assert.match(attrs, /role=["']tabpanel["']/i);
    const labelledBy = attrs.match(/aria-labelledby=["']([^"']+)["']/i)?.[1];
    assert.ok(labelledBy && tabIds.has(labelledBy));
  }
  for (const attrs of tabs) {
    assert.match(attrs, /type=["']button["']/i);
    assert.match(attrs, /role=["']tab["']/i);
    const controls = attrs.match(/aria-controls=["']([^"']+)["']/i)?.[1];
    assert.ok(controls && panelIds.has(controls));
    if (!/aria-selected=["']true["']/i.test(attrs)) assert.match(attrs, /tabindex=["']-1["']/i);
  }
  assert.equal(tabs.filter((attrs) => /aria-selected=["']true["']/i.test(attrs)).length, 1);

  assert.match(site, /addEventListener\(["']click["']/);
  assert.match(site, /addEventListener\(["']keydown["']/);
  for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']) assert.match(site, new RegExp(key));
  assert.match(site, /thumb\.tabIndex\s*=/);
  assert.match(site, /panel\.hidden\s*=/);
  assert.match(site, /panel\.setAttribute\(["']aria-hidden["']/);
});

test('homepage legal identity and support details occur only in the footer', () => {
  const index = read('index.html');
  const footerStart = index.search(/<footer\b/i);
  const footerEnd = index.search(/<\/footer\s*>/i);
  assert.ok(footerStart >= 0 && footerEnd > footerStart, 'homepage must have a footer');
  const beforeFooter = index.slice(0, footerStart);
  const footer = index.slice(footerStart, footerEnd + 9);
  assert.doesNotMatch(beforeFooter, /Ginty United Investments Pty Ltd/i);
  assert.doesNotMatch(beforeFooter, /ABN\s*78\s*606\s*187\s*106/i);
  assert.doesNotMatch(beforeFooter, /support@docked\.com\.au/i);
  assert.match(footer, /Sold by Ginty United Investments Pty Ltd[\s\S]*ABN\s*78\s*606\s*187\s*106[\s\S]*support@docked\.com\.au/i);
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
    /\bstrong\s+and\s+stable\s+design\b/i,
    /\b90[- ]minute\s+runtime\b/i,
    /\b66\s*w\s+dual\s+motors?\b/i,
    /\blong[- ]lasting\s+battery\b/i,
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
  assert.match(css, /\.site-nav \.nav-cta\s*\{[^}]*background:\s*var\(--sunshine\)/s);
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

test('man lifestyle card preserves its 3:2 image without CSS crop forcing', () => {
  const css = read('assets/css/styles.css');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => match[1].split(',').some((selector) => selector.trim() === '.product-photo-card img'))
    .map((match) => match[2]);
  assert.ok(rules.length > 0);
  assert.ok(rules.some((body) => /\baspect-ratio\s*:\s*3\s*\/\s*2\b/i.test(body)));
  assert.ok(rules.some((body) => /\bmin-height\s*:\s*0(?:[a-z%]+)?\b/i.test(body)));

  const declarations = rules.flatMap((body) => body.split(';'))
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const colon = declaration.indexOf(':');
      return {
        property: colon >= 0 ? declaration.slice(0, colon).trim().toLowerCase() : '',
        value: colon >= 0 ? declaration.slice(colon + 1).trim().toLowerCase() : '',
      };
    });
  for (const { property, value } of declarations) {
    if (property === 'min-height') assert.match(value, /^0(?:[a-z%]+)?(?:\s*!important)?$/i);
    if (property === 'height') assert.match(value, /^auto(?:\s*!important)?$/i);
    if (property === 'max-height') assert.match(value, /^none(?:\s*!important)?$/i);
    if (property === 'clip-path') assert.match(value, /^none(?:\s*!important)?$/i);
    if (property === 'transform') assert.doesNotMatch(value, /scale/i);
  }

  const index = read('index.html');
  const image = index.match(/<img\b(?=[^>]*cruise-d2-lifestyle-man-1200\.webp)[^>]*>/i)?.[0] ?? '';
  assert.match(image, /width=["']1200["']/i);
  assert.match(image, /height=["']800["']/i);
});

test('approved man and woman lifestyle derivatives are byte-locked and responsive', () => {
  const expected = new Map([
    ['assets/images/product/cruise-d2-lifestyle-man-1200.webp', 'F4000655664C9C191FA490741D69ED626B5DEA58AFCA31E6153A37FE5BAE5532'],
    ['assets/images/product/cruise-d2-lifestyle-man-600.webp', '3F6DCFE50254F91A1C17172DB90969C92C26DFC6E136DC2893E9D395687B0221'],
    ['assets/images/product/cruise-d2-lifestyle-woman-1200.webp', 'FFC9A0077793CE2AEE2FA310FCCC175581089695900B5F6EC4B111381F76E89B'],
    ['assets/images/product/cruise-d2-lifestyle-woman-600.webp', '1BD22C4389CE63B689AE22F6F1D7D579714D8669D9D32ED7BB30F50E921FF0FC'],
  ]);
  for (const [file, hash] of expected) {
    const bytes = fs.readFileSync(path.join(root, file));
    assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP');
    assert.equal(createHash('sha256').update(bytes).digest('hex').toUpperCase(), hash);
  }
  const index = read('index.html');
  for (const person of ['man', 'woman']) {
    assert.match(index, new RegExp(`cruise-d2-lifestyle-${person}-600\\.webp\\s+600w`));
    const image = index.match(new RegExp(`<img\\b(?=[^>]*cruise-d2-lifestyle-${person}-1200\\.webp)[^>]*>`, 'i'))?.[0] ?? '';
    assert.match(image, /width=["']1200["']/i);
    assert.match(image, /height=["']800["']/i);
    assert.match(image, /alt=["'][^"']+["']/i);
  }
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
    'CBF4A3F9508F01A17732FC24853ECEDD1B99CFE3CD3A5BEB104023DDE8FE01A7',
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
