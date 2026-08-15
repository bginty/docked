import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';

const root = process.cwd();
const requiredPages = [
  'index.html',
  'safety.html',
  'shipping-returns.html',
  'privacy.html',
  'terms.html',
  'thank-you.html',
  '404.html',
];
const requiredFiles = [
  ...requiredPages,
  'CNAME',
  '.nojekyll',
  'robots.txt',
  'sitemap.xml',
  'site.webmanifest',
  'assets/css/styles.css',
  'assets/js/product-config.js',
  'assets/js/site.js',
  'assets/images/product/cruise-d2-pool-1200.webp',
  'assets/images/product/cruise-d2-pool-600.webp',
  'assets/images/product/cruise-d2-overview-1200.webp',
  'assets/images/product/cruise-d2-overview-600.webp',
  'assets/images/product/cruise-d2-controls-1200.webp',
  'assets/images/product/cruise-d2-controls-600.webp',
  'assets/images/product/cruise-d2-social-1200.jpg',
  'docs/STATIC_SITE_ASSET_REGISTER.md',
  'docs/STATIC_PAYPAL_DEPLOYMENT.md',
  'docs/STATIC_PAYPAL_ROLLBACK.md',
];

const failures = [];
const checks = [];

function pass(name, detail) {
  checks.push({ name, detail });
}

function fail(name, detail) {
  failures.push({ name, detail });
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function sha256(relativePath) {
  return createHash('sha256').update(fs.readFileSync(path.join(root, relativePath))).digest('hex').toUpperCase();
}

function assert(name, condition, detail) {
  if (condition) pass(name, detail);
  else fail(name, detail);
}

const missing = requiredFiles.filter((file) => !exists(file));
assert('structure.required-files', missing.length === 0, missing.length ? `Missing: ${missing.join(', ')}` : `${requiredFiles.length} required files present`);

if (missing.length === 0) {
  assert('domain.cname', read('CNAME').trim() === 'docked.com.au', 'CNAME is docked.com.au');
  assert('pages.nojekyll', fs.statSync(path.join(root, '.nojekyll')).isFile(), '.nojekyll exists');

  const htmlByFile = new Map(requiredPages.map((file) => [file, read(file)]));
  const publicTextFiles = [
    ...requiredPages,
    'robots.txt',
    'sitemap.xml',
    'site.webmanifest',
    'assets/css/styles.css',
    'assets/js/product-config.js',
    'assets/js/site.js',
  ];
  const publicText = publicTextFiles.map((file) => `${file}\n${read(file)}`).join('\n').toLowerCase();

  const financeTerms = [
    'mortgage', 'loan', 'broker', 'borrowing', 'affordability', 'refinance',
    'lender', 'repayment', 'credit assistance', 'bank statement',
  ];
  const financeHits = financeTerms.filter((term) => publicText.includes(term));
  assert('content.no-finance-copy', financeHits.length === 0, financeHits.length ? `Found: ${financeHits.join(', ')}` : 'No legacy finance terms in public output');

  const shopifyHits = ['shopify', 'myshopify', 'shopifycdn', 'cdn.shopify'].filter((term) => publicText.includes(term));
  assert('content.no-shopify', shopifyHits.length === 0, shopifyHits.length ? `Found: ${shopifyHits.join(', ')}` : 'No Shopify references in public output');

  const placeholders = [
    'paste_the_real_paypal_payment_link_here',
    'paste_paypal_buy_button_embed_code_here',
    'real_paypal_payment_link',
    'todo', 'tbd', 'lorem ipsum',
  ];
  const placeholderHits = placeholders.filter((term) => publicText.includes(term));
  assert('checkout.no-placeholders', placeholderHits.length === 0, placeholderHits.length ? `Found: ${placeholderHits.join(', ')}` : 'No placeholder checkout or draft copy');

  const productImageHashes = new Map([
    ['assets/images/product/cruise-d2-pool-1200.webp', '20DF5BEB0C943D520B8046C0AECB17D91327C8B40D32E70B6CC86A3E53D62345'],
    ['assets/images/product/cruise-d2-pool-600.webp', 'CDE094AB9E31F36DFC94C97FF23C8B7BDAC0B0004C0592E5159BA636894E5ACA'],
    ['assets/images/product/cruise-d2-overview-1200.webp', '997C319C86592B570726D22B3B5B5AFFACD2EB4F0EBBB898FE2B13C21A914214'],
    ['assets/images/product/cruise-d2-overview-600.webp', '2657B7F06D570D7C2F60D8B345D095ECA10E728562CC563F3082F76F5EDF8BB2'],
    ['assets/images/product/cruise-d2-controls-1200.webp', '70A780E4E1F8BF0A13FB98F5B14B6D56EB8883125F6D241373B34C15D76F5340'],
    ['assets/images/product/cruise-d2-controls-600.webp', 'E5E6DA93DA8256346D8B5A86AF56490DA5472827BD2B33E0DC9EF92CB8986DD8'],
    ['assets/images/product/cruise-d2-social-1200.jpg', '852B87ACA39C0599C23EA7414892FE1B38362AADF262957A885CFF4AF601FAFF'],
  ]);
  const productImageDrift = [...productImageHashes].filter(([file, hash]) => sha256(file) !== hash).map(([file]) => file);
  assert('assets.product-media', productImageDrift.length === 0, productImageDrift.length ? `Unexpected product-media bytes: ${productImageDrift.join(', ')}` : 'Seven approved supplier-image derivatives match the asset register');

  const index = htmlByFile.get('index.html');
  const config = read('assets/js/product-config.js');
  const checkoutEnabled = /checkoutEnabled\s*:\s*true\b/.test(config);
  const paypalSdkMatches = [...index.matchAll(/<script\b[^>]*src=["']https:\/\/www\.paypal\.com\/sdk\/js\?([^"']+)["'][^>]*>\s*<\/script>/gi)];
  const paypalSdkQuery = paypalSdkMatches[0]?.[1]?.replaceAll('&amp;', '&') ?? '';
  const paypalSdkParams = new URLSearchParams(paypalSdkQuery);
  const publicClientId = paypalSdkParams.get('client-id') ?? '';
  const hostedButtonId = config.match(/paypalHostedButtonId\s*:\s*["']([^"']*)["']/)?.[1] ?? '';
  const hostedContainerCount = hostedButtonId ? (index.match(new RegExp(`id=["']paypal-container-${hostedButtonId}["']`, 'g')) ?? []).length : 0;
  const hostedRenderCount = hostedButtonId ? (index.match(new RegExp(`hostedButtonId:\\s*["']${hostedButtonId}["']`, 'g')) ?? []).length : 0;
  if (checkoutEnabled) {
    assert(
      'checkout.hosted-button',
      /paypalIntegration\s*:\s*["']hosted-buttons["']/.test(config) &&
        hostedButtonId.length >= 8 &&
        paypalSdkMatches.length === 1 && publicClientId.length >= 40 &&
        paypalSdkParams.get('components') === 'hosted-buttons' &&
        paypalSdkParams.get('currency') === 'AUD' &&
        paypalSdkParams.get('disable-funding') === 'venmo' &&
        hostedContainerCount === 1 && hostedRenderCount === 1 &&
        /paypalPaymentLink\s*:\s*["']\s*["']/.test(config),
      `Official PayPal hosted-button mode: id=${hostedButtonId || 'missing'}, SDK=${paypalSdkMatches.length}, container=${hostedContainerCount}, render=${hostedRenderCount}, currency=${paypalSdkParams.get('currency') ?? 'missing'}`,
    );
  } else {
    const paypalSource = publicTextFiles.map(read).join('\n');
    assert(
      'checkout.fail-closed',
      paypalSdkMatches.length === 0 && !/paypal\.HostedButtons|paypal-container-|paypalobjects\.com/i.test(paypalSource) &&
        /paypalIntegration\s*:\s*["']\s*["']/.test(config) &&
        /paypalHostedButtonId\s*:\s*["']\s*["']/.test(config) &&
        /paypalPaymentLink\s*:\s*["']\s*["']/.test(config),
      'Checkout disabled: no PayPal URL, SDK, hosted-button ID, container, form, iframe, or credentials',
    );
  }

  const fakePurchaseControls = [];
  for (const [file, html] of htmlByFile) {
    const interactive = html.matchAll(/<(a|button)\b[^>]*>([\s\S]*?)<\/\1>/gi);
    for (const match of interactive) {
      const text = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const open = match[0].slice(0, match[0].indexOf('>') + 1);
      const href = open.match(/\bhref=["']([^"']*)["']/i)?.[1] ?? '';
      const isCheckoutSectionLink = /^(?:\/)?#ordering$/.test(href);
      if (/\b(?:buy now|order now|pay now|pay with paypal)\b/i.test(text) && !isCheckoutSectionLink || /href=["'](?:#|javascript:|\s*)["']/i.test(open) && /\b(?:buy|order|pay)\b/i.test(text)) {
        fakePurchaseControls.push(`${file}: ${text}`);
      }
    }
  }
  assert('checkout.no-fake-control', fakePurchaseControls.length === 0, fakePurchaseControls.length ? fakePurchaseControls.join('; ') : 'No fake or disabled-looking purchase control');

  assert('product.config', /name\s*:\s*['"]Docked Cruise D2['"]/.test(config) && /price\s*:\s*649(?:\.0+)?\b/.test(config) && /currency\s*:\s*['"]AUD['"]/.test(config), 'Config identifies Docked Cruise D2 at A$649 AUD');
  assert('product.checkout-mode', checkoutEnabled ? /paypalIntegration\s*:\s*['"]hosted-buttons['"]/.test(config) : /checkoutEnabled\s*:\s*false\b/.test(config), checkoutEnabled ? 'Exactly one checkout mode is configured: PayPal hosted button' : 'Checkout is explicitly disabled');

  assert('product.checkout-copy', checkoutEnabled ? index.includes('Secure checkout powered by PayPal.') : index.includes('Online ordering is not yet available.'), checkoutEnabled ? 'Hosted-checkout disclosure is visible' : 'Ordering-unavailable notice is visible');
  assert(
    'shipping.owner-approved-offer',
    /market\s*:\s*['"]Worldwide['"]/.test(config) &&
      index.includes('Free worldwide shipping') &&
      read('shipping-returns.html').includes('Free standard shipping is included worldwide'),
    'Worldwide market and free-shipping wording match the owner-approved offer',
  );
  const adultWarning = 'Adults 18+ only. For competent swimmers in calm, controlled swimming pools. Not a life-saving device.';
  assert('product.adult-warning', index.includes(adultWarning) && (index.match(/Adults 18\+/g) ?? []).length === 1, 'One concise adult safety warning is visible near checkout');
  assert('product.price-target', /data-product-price/.test(index), 'Homepage exposes the single configured price target');
  assert(
    'content.product-first',
    /cruise-d2-pool-1200\.webp/.test(index) && /cruise-d2-overview-1200\.webp/.test(index) && /cruise-d2-controls-1200\.webp/.test(index) &&
      !/unverified performance|original brand illustrations|the Docked approach|confirmed before dispatch/i.test(publicText),
    'Homepage uses approved product media and contains no internal compliance-preview copy',
  );

  const unsupportedPatterns = [
    /\b(?:30|90)[ -]?minute(?:s)?\b/i,
    /\b(?:46|66)\s*w(?:att)?s?\b/i,
    /\b(?:1\.6\s*m\/s|5\s*k(?:m|ph)|160\s*kg|2\.8\s*kg)\b/i,
    /\b(?:puncture-proof|unsinkable|child-safe|completely waterproof|rcm-approved|australian certified)\b/i,
    /\b(?:in stock|low stock|only \d+ left|compare-at|was a\$|save \d+%)\b/i,
  ];
  const unsupportedHits = unsupportedPatterns.filter((pattern) => pattern.test(publicTextFiles.map(read).join('\n'))).map(String);
  assert('claims.conservative', unsupportedHits.length === 0, unsupportedHits.length ? `Unsupported marketing claim patterns: ${unsupportedHits.join(', ')}` : 'No blocked numeric, certification, urgency, or durability claims');

  const structuredProduct = /["']@type["']\s*:\s*["'](?:Product|Offer|AggregateRating|Review)["']/i.test(publicTextFiles.map(read).join('\n'));
  assert('seo.no-unverified-commerce-schema', !structuredProduct, 'No unverified Product, Offer, availability, rating, or review schema');

  const linkProblems = [];
  const fragmentProblems = [];
  for (const [file, html] of htmlByFile) {
    const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]));
    for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
      const target = match[1].trim();
      if (!target || /^(?:https?:|mailto:|tel:|data:)/i.test(target)) continue;
      if (target.startsWith('#')) {
        if (!ids.has(target.slice(1))) fragmentProblems.push(`${file} -> ${target}`);
        continue;
      }
      const [relativeTarget, fragment] = target.split('#');
      const cleanTarget = relativeTarget.split('?')[0];
      const rootRelative = cleanTarget.startsWith('/');
      const localTarget = rootRelative ? cleanTarget.replace(/^\/+/, '') || 'index.html' : cleanTarget;
      const resolved = rootRelative
        ? path.resolve(root, localTarget)
        : path.resolve(root, path.dirname(file), localTarget);
      const relativeResolved = path.relative(root, resolved);
      if (relativeResolved.startsWith('..') || path.isAbsolute(relativeResolved) || !fs.existsSync(resolved)) {
        linkProblems.push(`${file} -> ${target}`);
        continue;
      }
      if (fragment && (path.extname(localTarget).toLowerCase() === '.html' || localTarget === 'index.html')) {
        const linkedHtml = fs.readFileSync(resolved, 'utf8');
        if (!new RegExp(`\\bid=["']${fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(linkedHtml)) fragmentProblems.push(`${file} -> ${target}`);
      }
    }
  }
  assert('links.resolved', linkProblems.length === 0, linkProblems.length ? linkProblems.join('; ') : 'All local href/src references resolve');
  assert('links.fragments', fragmentProblems.length === 0, fragmentProblems.length ? fragmentProblems.join('; ') : 'All local fragments resolve');

  const pageIssues = [];
  const canonicalUrls = new Set();
  for (const [file, html] of htmlByFile) {
    if (!/<html\b[^>]*lang=["']en-AU["']/i.test(html)) pageIssues.push(`${file}: missing lang=en-AU`);
    if (!/<meta\b[^>]*name=["']viewport["']/i.test(html)) pageIssues.push(`${file}: missing viewport`);
    if ((html.match(/<h1\b/gi) ?? []).length !== 1) pageIssues.push(`${file}: expected exactly one h1`);
    if (!/<main\b/i.test(html)) pageIssues.push(`${file}: missing main landmark`);
    if (!/<a\b[^>]*class=["'][^"']*skip-link/i.test(html)) pageIssues.push(`${file}: missing skip link`);
    if (!/\bdata-menu-toggle\b/i.test(html) || !/\bdata-site-nav\b/i.test(html)) pageIssues.push(`${file}: mobile navigation contract incomplete`);
    const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1];
    if (!canonical?.startsWith('https://docked.com.au')) pageIssues.push(`${file}: invalid/missing canonical`);
    else canonicalUrls.add(canonical);
    if (/<form\b/i.test(html)) pageIssues.push(`${file}: form found on static no-backend site`);
    for (const image of html.matchAll(/<img\b([^>]*)>/gi)) {
      const attrs = image[1];
      if (!/\bwidth=["']\d+["']/i.test(attrs) || !/\bheight=["']\d+["']/i.test(attrs)) pageIssues.push(`${file}: image lacks intrinsic dimensions`);
      if (!/\balt=["'][^"']*["']/i.test(attrs)) pageIssues.push(`${file}: image lacks alt`);
    }
  }
  assert('html.semantic-baseline', pageIssues.length === 0, pageIssues.length ? pageIssues.join('; ') : `${requiredPages.length} pages meet the semantic baseline`);
  assert('seo.unique-canonicals', canonicalUrls.size === requiredPages.length, `${canonicalUrls.size}/${requiredPages.length} unique canonical URLs`);
  assert('seo.thank-you-noindex', /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(htmlByFile.get('thank-you.html')), 'Thank-you page is noindex');

  const manifest = JSON.parse(read('site.webmanifest'));
  assert('pwa.manifest', manifest.name === 'Docked' && manifest.start_url === '/', 'Manifest parses with Docked root start URL');
  const sitemap = read('sitemap.xml');
  const sitemapMissing = requiredPages.filter((file) => !['thank-you.html', '404.html'].includes(file) && !sitemap.includes(`https://docked.com.au/${file === 'index.html' ? '' : file}`));
  assert('seo.sitemap', sitemapMissing.length === 0, sitemapMissing.length ? `Missing sitemap URLs: ${sitemapMissing.join(', ')}` : 'Public pages are represented in sitemap');

  const scripts = ['assets/js/product-config.js', 'assets/js/site.js'];
  for (const script of scripts) {
    try {
      new Function(read(script));
      pass(`javascript.syntax.${path.basename(script)}`, 'JavaScript parses');
    } catch (error) {
      fail(`javascript.syntax.${path.basename(script)}`, error.message);
    }
  }

  const secretPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /(?:client_secret|api[_-]?key|access[_-]?token|password)\s*[:=]\s*["'][^"']{8,}["']/i,
    /https?:\/\/[^\s/@:]+:[^\s/@]+@/,
  ];
  const candidatePaths = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (['.git', 'node_modules', '.codex-remote-attachments'].includes(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else candidatePaths.push(absolute);
    }
  }
  walk(root);
  const secretHits = [];
  for (const absolute of candidatePaths) {
    const buffer = fs.readFileSync(absolute);
    if (buffer.includes(0)) continue;
    const text = buffer.toString('utf8');
    if (secretPatterns.some((pattern) => pattern.test(text))) secretHits.push(path.relative(root, absolute));
  }
  assert('security.secret-scan', secretHits.length === 0, secretHits.length ? `Potential secrets: ${secretHits.join(', ')}` : `${candidatePaths.length} text-file candidates scanned; no high-confidence secret pattern found`);
}

for (const check of checks) console.log(`PASS ${check.name}: ${check.detail}`);
for (const failure of failures) console.error(`FAIL ${failure.name}: ${failure.detail}`);
console.log(`\nStatic site validation: ${checks.length} passed, ${failures.length} failed.`);
if (failures.length) process.exitCode = 1;
